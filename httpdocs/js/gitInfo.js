async function fetchGitInfo() {
    try {
        const owner = 'Lixias';
        const repo = 'website';
        const branch = 'main';
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const date = data.commit.author.date;
        const message = data.commit.message;
        const shortSha = data.sha.substring(0, 7);

        const footer = document.querySelector('footer');
        const gitInfoDiv = document.createElement('div');
        gitInfoDiv.className = 'git-info text-body-secondary';
        gitInfoDiv.innerHTML = `
            <p class="mb-0">
                Last modified: ${new Date(date).toLocaleDateString()} 
                | Comment: <a href="https://github.com/${owner}/${repo}/commit/${data.sha}" 
                    class="text-body-secondary" 
                    title="${message}"
                    target="_blank">${message.substring(0, 50)}${message.length > 50 ? '...' : ''}</a>
            </p>`;
        footer.appendChild(gitInfoDiv);
    } catch (error) {
        console.error('Error fetching git info:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchGitInfo);
