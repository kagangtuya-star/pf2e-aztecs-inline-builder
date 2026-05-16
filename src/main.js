import { PF2eInlineBuilderUI } from "./ui.js"
import { registerSettings } from "./settings.js"

Hooks.once("init", () => {
   registerSettings()

   game.keybindings.register("pf2e-aztecs-inline-builder", "openBuilder", {
      name: "PF2E-AZTECS.Keybinding",
      hint: "PF2E-AZTECS.KeybindingHint",
      editable: [
         {
            key: "KeyB",
            modifiers: [
               foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.ALT,
            ],
         },
      ],
      onDown: () => {
         new PF2eInlineBuilderUI({
            targetElement: document.activeElement,
         }).render(true)
         return true
      },
      restricted: false,
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
   })
})

Hooks.once("ready", () => {
   window.addEventListener(
      "keydown",
      (event) => {
         if (!event.altKey || event.code !== "KeyB") return

         const target = document.activeElement
         const isInput =
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable

         if (isInput) {
            event.preventDefault()
            event.stopPropagation()
            new PF2eInlineBuilderUI({ targetElement: target }).render(true)
         }
      },
      { capture: true },
   )
})
