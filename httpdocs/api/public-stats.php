<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

const CONFIG_PATH = __DIR__ . '/../../private/awstats-auth.php';
const SAMPLE_PATH = __DIR__ . '/../../private/awstats-sample.txt';
const CACHE_PATH = __DIR__ . '/../../private/public-stats-cache.json';
const CACHE_TTL_SECONDS = 900;

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
    if (!is_readable(CACHE_PATH)) {
        return null;
    }

    $raw = file_get_contents(CACHE_PATH);
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

    @file_put_contents(CACHE_PATH, json_encode($cache, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
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

try {
    if (isset($_GET['sample'])) {
        if (!is_readable(SAMPLE_PATH)) {
            respond(['available' => false, 'message' => 'Stats sample unavailable'], 503);
        }

        $sample = file_get_contents(SAMPLE_PATH);
        if ($sample === false) {
            respond(['available' => false, 'message' => 'Stats sample unavailable'], 503);
        }

        $payload = parseAwstatsSummary($sample);
        assertCurrentMonth($payload);
        respond($payload);
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

    if (!is_readable(CONFIG_PATH)) {
        respond(['available' => false, 'message' => 'Stats unavailable'], 503);
    }

    $config = require CONFIG_PATH;
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
