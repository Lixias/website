export async function fetchGitInfo() {
    try {
        const owner = 'Lixias';
        const repo = 'website';
        const branch = 'main';
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const date = new Date(data.commit.author.date);
        const message = data.commit.message;
        
        // Update copyright year
        document.getElementById('copyright-year').textContent = date.getFullYear();
        
        // Update git info
        const gitInfoDiv = document.getElementById('git-info');
        gitInfoDiv.innerHTML = `
            <small>
                Last modified: ${date.toLocaleDateString()} 
                <br>
                Comment: <a href="https://github.com/${owner}/${repo}/commit/${data.sha}" 
                    class="text-body-secondary" 
                    title="${message}"
                    target="_blank">${message.substring(0, 30)}${message.length > 30 ? '...' : ''}</a>
            </small>`;
    } catch (error) {
        console.error('Error fetching git info:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchGitInfo);
