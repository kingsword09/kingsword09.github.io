import "./theme";
import "./search";
import "./code";

function boot() {
  if (document.querySelector(".chat-widget")) {
    void import("./chat");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

