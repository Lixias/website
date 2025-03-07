import { initThemeToggle } from './themeToggle.js';
import { fetchGitInfo } from './gitInfo.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme toggle
    initThemeToggle();
    
    // Initialize git info
    fetchGitInfo();
S    
    // Set copyright year
    document.getElementById('copyright-year').textContent = new Date().getFullYear();
});