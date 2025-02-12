export function initThemeToggle() {
    const button = document.getElementById('theme-toggle');
    if (!button) {
        console.error('Theme toggle button not found');
        return;
    }
  
    // Get the fresh reference after replacement
    const newButton = document.getElementById('theme-toggle');
    
    newButton.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-bs-theme', newTheme);
        console.log(`Theme changed to: ${newTheme}`);
    });
}