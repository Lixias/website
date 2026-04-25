<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

const CACHE_TTL_SECONDS = 900;

function privatePathCandidates(string $file): array
{
    return [
        __DIR__ . '/../../private/' . $file,
        __DIR__ . '/../private/' . $file,
        __DIR__ . '/' . $file,
    ];
}

function privatePath(string $file): string
{
    $paths = privatePathCandidates($file);
    foreach ($paths as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }

    return $paths[0];
}

function privatePathDiagnostics(string $file): array
{
    return array_map(static function (string $path): array {
        return [
            'path' => $path,
            'exists' => file_exists($path),
            'readable' => is_readable($path),
            'directoryExists' => is_dir(dirname($path)),
            'directoryReadable' => is_readable(dirname($path)),
        ];
    }, privatePathCandidates($file));
}

function writablePrivatePath(string $file): string
{
    $paths = [
        __DIR__ . '/../../private/' . $file,
        __DIR__ . '/../private/' . $file,
    ];

    foreach ($paths as $path) {
        $directory = dirname($path);
        if (is_dir($directory) && is_writable($directory)) {
            return $path;
        }
    }

    return $paths[0];
}

function respond(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function cleanText(string $html): string
{
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    return trim($text);
}

function firstMatch(string $pattern, string $text, int $group = 1): ?string
{
    if (!preg_match($pattern, $text, $matches)) {
        return null;
    }

    return trim($matches[$group]);
}

function parseAwstatsSummary(string $html): array
{
    $text = cleanText($html);
    $period = firstMatch('/Reported period\s+(?:Month\s+)?([A-Za-z]{3,9}\s+\d{4})/i', $text);
    $updated = firstMatch('/Last Update:\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+-\s*(\d{2}:\d{2})/i', $text);
    $updatedTime = firstMatch('/Last Update:\s*\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+-\s*(\d{2}:\d{2})/i', $text);
    $lastVisit = firstMatch('/Last visit\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+-\s*(\d{2}:\d{2})/i', $text);
    $lastVisitTime = firstMatch('/Last visit\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+-\s*(\d{2}:\d{2})/i', $text);

    $trafficPattern = '/Viewed traffic\s*\*?\s+([\d,]+)\s+([\d,]+)\s*\(([\d.]+)\s+visits\/visitor\)/i';
    if (!preg_match($trafficPattern, $text, $trafficMatches)) {
        throw new RuntimeException('AWStats viewed traffic summary was not found.');
    }

    if ($period === null || $updated === null || $updatedTime === null || $lastVisit === null || $lastVisitTime === null) {
        throw new RuntimeException('AWStats date summary was not found.');
    }

    return [
        'available' => true,
        'period' => $period,
        'visitors' => (int) str_replace(',', '', $trafficMatches[1]),
        'visits' => (int) str_replace(',', '', $trafficMatches[2]),
        'visitsPerVisitor' => $trafficMatches[3],
        'lastVisit' => $lastVisit . ' ' . $lastVisitTime,
        'updated' => $updated . ' ' . $updatedTime,
    ];
}

function assertCurrentMonth(array $payload): void
{
    $currentPeriod = date('M Y');
    if (($payload['period'] ?? '') !== $currentPeriod) {
        throw new RuntimeException('AWStats report is not for the current month.');
    }
}

function readCache(): ?array
{
    $cachePath = privatePath('public-stats-cache.json');
    if (!is_readable($cachePath)) {
        return null;
    }

    $raw = file_get_contents($cachePath);
    if ($raw === false) {
        return null;
    }

    $cached = json_decode($raw, true);
    if (!is_array($cached) || !isset($cached['createdAt'], $cached['payload'])) {
        return null;
    }

    if ((time() - (int) $cached['createdAt']) > CACHE_TTL_SECONDS) {
        return null;
    }

    return is_array($cached['payload']) ? $cached['payload'] : null;
}

function writeCache(array $payload): void
{
    $cache = [
        'createdAt' => time(),
        'payload' => $payload,
    ];

    @file_put_contents(writablePrivatePath('public-stats-cache.json'), json_encode($cache, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function fetchProtectedStats(array $config): string
{
    foreach (['url', 'username', 'password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '') {
            throw new RuntimeException('AWStats configuration is incomplete.');
        }
    }

    $context = stream_context_create([
        'http' => [
            'header' => 'Authorization: Basic ' . base64_encode($config['username'] . ':' . $config['password']),
            'timeout' => 5,
        ],
    ]);

    $html = @file_get_contents($config['url'], false, $context);
    if ($html === false) {
        throw new RuntimeException('AWStats request failed.');
    }

    return $html;
}

function fetchProtectedStatsProbe(array $config): array
{
    foreach (['url', 'username', 'password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '') {
            return [
                'ok' => false,
                'stage' => 'config',
                'message' => 'AWStats configuration is incomplete.',
            ];
        }
    }

    $context = stream_context_create([
        'http' => [
            'header' => 'Authorization: Basic ' . base64_encode($config['username'] . ':' . $config['password']),
            'timeout' => 5,
            'ignore_errors' => true,
        ],
    ]);

    $html = @file_get_contents($config['url'], false, $context);
    $status = 'unknown';
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $status = $matches[1];
    }

    if ($html === false) {
        return [
            'ok' => false,
            'stage' => 'fetch',
            'httpStatus' => $status,
            'message' => 'AWStats request failed.',
        ];
    }

    try {
        $payload = parseAwstatsSummary($html);
        assertCurrentMonth($payload);

        return [
            'ok' => true,
            'stage' => 'parse',
            'httpStatus' => $status,
            'bytes' => strlen($html),
            'period' => $payload['period'],
        ];
    } catch (Throwable $error) {
        return [
            'ok' => false,
            'stage' => 'parse',
            'httpStatus' => $status,
            'bytes' => strlen($html),
            'message' => $error->getMessage(),
        ];
    }
}

try {
    if (isset($_GET['sample'])) {
        $samplePath = privatePath('awstats-sample.txt');
        if (!is_readable($samplePath)) {
            respond(['available' => false, 'message' => 'Stats sample unavailable'], 503);
        }

        $sample = file_get_contents($samplePath);
        if ($sample === false) {
            respond(['available' => false, 'message' => 'Stats sample unavailable'], 503);
        }

        $payload = parseAwstatsSummary($sample);
        assertCurrentMonth($payload);
        respond($payload);
    }

    if (isset($_GET['probe'])) {
        $configPath = privatePath('awstats-auth.php');
        if (!is_readable($configPath)) {
            respond([
                'ok' => false,
                'stage' => 'config',
                'message' => 'Stats config unavailable',
                'checked' => privatePathDiagnostics('awstats-auth.php'),
            ], 503);
        }

        $config = require $configPath;
        if (!is_array($config)) {
            respond([
                'ok' => false,
                'stage' => 'config',
                'message' => 'AWStats configuration is invalid.',
            ], 503);
        }

        respond(fetchProtectedStatsProbe($config));
    }

    $cached = readCache();
    if ($cached !== null) {
        try {
            assertCurrentMonth($cached);
            respond($cached);
        } catch (Throwable $error) {
            // Ignore stale cache and try to refresh from AWStats below.
        }
    }

    $configPath = privatePath('awstats-auth.php');
    if (!is_readable($configPath)) {
        respond(['available' => false, 'message' => 'Stats unavailable'], 503);
    }

    $config = require $configPath;
    if (!is_array($config)) {
        throw new RuntimeException('AWStats configuration is invalid.');
    }

    $payload = parseAwstatsSummary(fetchProtectedStats($config));
    assertCurrentMonth($payload);
    writeCache($payload);
    respond($payload);
} catch (Throwable $error) {
    respond(['available' => false, 'message' => 'Stats unavailable'], 503);
}
