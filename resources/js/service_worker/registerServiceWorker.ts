// Service Worker Registration
// Add this to your main app.jsx or in a useEffect in your layout

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        console.log("nigga");
    }
};
