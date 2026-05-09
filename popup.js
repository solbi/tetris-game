const helpButton = document.querySelector("#help-button");
const helpDialog = document.querySelector("#help-dialog");
const helpCloseButton = document.querySelector("#help-close-button");

if (helpButton && helpDialog && helpCloseButton) {
  helpButton.addEventListener("click", () => {
    if (typeof helpDialog.showModal === "function") {
      helpDialog.showModal();
    } else {
      helpDialog.setAttribute("open", "");
    }
  });

  helpCloseButton.addEventListener("click", () => {
    helpDialog.close();
  });

  helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) {
      helpDialog.close();
    }
  });
}
