// --- KILL SWITCH: REMOVE OLD APPS ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister()
            .then(() => console.log("Old App Brain deleted. Reload page now."));
        }
    });
}
// ------------------------------------
