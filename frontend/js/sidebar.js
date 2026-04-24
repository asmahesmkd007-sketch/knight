/**
 * PHOENIX X - Sidebar Loader
 * Fetches and injects the centralized sidebar component
 */
window.loadSidebar = window.loadSidebar || async function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    try {
        // Fetch the component
        const response = await fetch('/components/sidebar.html');
        if (!response.ok) throw new Error('Sidebar component not found');
        
        const html = await response.text();
        container.innerHTML = html;

        // Manually execute scripts inside the injected HTML
        const scripts = container.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const oldScript = scripts[i];
            const newScript = document.createElement('script');
            
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            
            // Append to body to execute
            document.body.appendChild(newScript);
            // Cleanup to keep DOM tidy
            if (!oldScript.src) document.body.removeChild(newScript);
        }

        // Initial UI sync if user data is ready
        if (typeof getUser === 'function' && typeof updateSidebarUI === 'function') {
            const user = getUser();
            if (user) updateSidebarUI(user);
        }

        return true;
    } catch (err) {
        console.error('❌ Sidebar load failure:', err);
        container.innerHTML = '<div style="padding:20px;color:var(--error);font-size:12px">Failed to load sidebar. Please refresh.</div>';
        return false;
    }
};

// Global helper to trigger sidebar updates from other scripts
window.syncSidebar = function(userData) {
    if (typeof updateSidebarUI === 'function') {
        updateSidebarUI(userData);
    }
};
