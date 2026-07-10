import { mountMomentsApp } from "../app/shared/components/AppShell.js";
import { createAppState } from "../app/shared/logic/state.js";
import { tr } from "../app/shared/logic/translations.js";

const dashboard = document.querySelector("#dashboard");
const devices = [
  { id: "android", title: tr.androidPreview, platform: "android" },
  { id: "iphone", title: tr.iphonePreview, platform: "ios" }
];

const states = Object.fromEntries(devices.map((device) => [device.id, createAppState(device.platform)]));
let selectedScreen = "home";

function renderDashboard() {
  dashboard.innerHTML = `
    <main class="dashboard">
      <header class="dashboard-header">
        <div>
          <h1>${tr.dashboardTitle}</h1>
          <p>${tr.dashboardSubtitle}</p>
        </div>
        <nav class="screen-switcher">
          ${["home", "camera", "chat", "profile", "settings", "discover"].map((screen) => `
            <button class="${selectedScreen === screen ? "active" : ""}" data-dashboard-screen="${screen}">${tr[screen]}</button>
          `).join("")}
        </nav>
      </header>
      <section class="device-grid">
        ${devices.map((device) => `
          <article class="device-card ${device.platform === "ios" ? "iphone" : "android"}">
            <h2>${device.title}</h2>
            <div class="phone-shell">
              <div class="phone-screen" id="${device.id}-root"></div>
            </div>
          </article>
        `).join("")}
      </section>
    </main>
  `;

  dashboard.querySelectorAll("[data-dashboard-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedScreen = button.dataset.dashboardScreen;
      Object.values(states).forEach((state) => {
        state.screen = selectedScreen;
      });
      renderDashboard();
    });
  });

  devices.forEach((device) => {
    states[device.id].screen = selectedScreen;
    mountMomentsApp(document.querySelector(`#${device.id}-root`), states[device.id], (state) => {
      selectedScreen = state.screen === "preview" ? selectedScreen : state.screen;
    });
  });
}

renderDashboard();
