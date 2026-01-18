const socket = io();

// Đăng ký user
socket.emit("registerUser", USER_ID);

socket.on("notification", (data) => {
    showPopupNotification(data.title, data.message, data.link);
});

function showPopupNotification(title, message, link) {
    const box = document.createElement("div");
    box.className = "fixed top-4 right-4 bg-white shadow-lg p-4 rounded-lg cursor-pointer z-50 animate-slide-in";
    box.innerHTML = `
        <h3 class="font-bold text-lg">${title}</h3>
        <p class="text-gray-600">${message}</p>
    `;

    box.onclick = () => {
        window.location.href = link;
    };

    document.body.appendChild(box);

    setTimeout(() => {
        box.remove();
    }, 6000);
}