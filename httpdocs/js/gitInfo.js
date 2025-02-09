async function fetchGitInfo() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/Lixias/website/main/gitInfo.json');
        const data = await response.json();
        const { date, message } = data;

        const footer = document.querySelector('footer');
        const gitInfoDiv = document.createElement('div');
        gitInfoDiv.className = 'git-info';
        gitInfoDiv.innerHTML = `<p>Last modified: ${new Date(date).toLocaleDateString()}</p><p>Latest commit: ${message}</p>`;
        footer.appendChild(gitInfoDiv);
    } catch (error) {
        console.error('Error fetching git info:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchGitInfo);
