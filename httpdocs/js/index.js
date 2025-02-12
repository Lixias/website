import { initThemeToggle } from './themeToggle.js';
import { fetchGitInfo } from './gitInfo.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme toggle
    initThemeToggle();
    
    // Initialize git info
    fetchGitInfo();
});