import { mountMomentsApp } from "./shared/components/AppShell.js";
import { createAppState } from "./shared/logic/state.js";

const root = document.querySelector("#app-root");
const state = createAppState("ios");

mountMomentsApp(root, state);
