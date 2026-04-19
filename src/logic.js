export class PF2eInlineLogic {
   static buildSyntax(state) {
      const label = state.customLabel?.trim()
         ? `{${state.customLabel.trim()}}`
         : ""
      let syntax = ""

      switch (state.type) {
         case "Flat":
            syntax = `@Check[flat|dc:${state.dc || 10}]`
            break
         case "Check":
         case "Save":
            syntax = this.#buildCheckSave(state)
            break
         case "Damage":
            syntax = this.#buildDamage(state)
            break
         case "Template":
            syntax = this.#buildTemplate(state)
            break
         case "Roll":
            return this.#buildRoll(state)
         case "Action":
            return this.#buildAction(state)
         case "Condition":
            return this.#buildCondition(state)
      }

      return syntax + label
   }

   static #buildCheckSave(state) {
      const parts = []

      const isSave = state.type === "Save"
      const keys = isSave ? state.saveKeys : state.checkKeys
      const adjTypes = isSave ? state.saveAdjTypes : state.checkAdjTypes
      const adjValues = isSave ? state.saveAdjValues : state.checkAdjValues

      const mappedKeys = keys.map((k) => {
         if (k === "lore") {
            const safeLore = (state.loreName || "custom")
               .trim()
               .toLowerCase()
               .replace(/\s+/g, "-")
            return `${safeLore}-lore`
         }
         return k
      })

      parts.push(mappedKeys.join(","))

      if (state.dcMode === "dc") {
         let dcVal = ""

         if (state.isLevelDC) {
            dcVal = "@self.level"
         } else if (state.isResolve) {
            const op = state.resolveOp
            const args = state.resolveArgs.map((a) => a.trim() || "0")

            if (op === "none") {
               dcVal = `resolve(${args[0]})`
            } else if (op === "ternary") {
               dcVal = `resolve(${args[0]} ? ${args[1]} : ${args[2]})`
            } else {
               dcVal = `resolve(${op}(${args.join(",")}))`
            }
         } else {
            dcVal = state.dc
         }

         if (dcVal) parts.push(`dc:${dcVal}`)
      } else if (state.dcMode === "against") {
         parts.push(
            `against:${state.againstType || state.against || "class-spell"}`,
         )
      } else if (state.dcMode === "defense") {
         parts.push(
            `defense:${state.defenseType || state.defense || "perception"}`,
         )
      }

      const adjustments = keys.map((_, i) => {
         const t = adjTypes[i]
         const v = adjValues[i]
         const finalAdj = t || v
         return finalAdj && finalAdj !== "0" ? finalAdj : "0"
      })

      if (adjustments.some((a) => a !== "0")) {
         parts.push(`adjustment:${adjustments.join(",")}`)
      }

      if (state.basicSave && state.type === "Save") parts.push("basic")
      if (state.rollerRole) parts.push(`rollerRole:${state.rollerRole}`)
      if (state.showDC && state.showDC !== "owner")
         parts.push(`showDC:${state.showDC}`)
      if (state.immutable) parts.push("immutable")
      if (state.overrideTraits) parts.push("overrideTraits")

      const traits = state.traits
         ? state.traits.split(",").map((t) => t.trim())
         : []
      if (state.isSecret && !traits.includes("secret")) traits.push("secret")
      if (traits.length) parts.push(`traits:${traits.join(",")}`)
      if (state.options) parts.push(`options:${state.options}`)
      if (state.chatCardName?.trim())
         parts.push(`name:${state.chatCardName.trim()}`)

      return `@Check[${parts.join("|")}]`
   }

   static #buildDamage(state) {
      const pools = state.damagePools
         .map((p) => {
            let formula =
               p.diceCount && p.diceFaces
                  ? `${p.diceCount}d${p.diceFaces}${p.fixedValue ? `+${p.fixedValue}` : ""}`
                  : p.fixedValue

            if (!formula) return null

            const t = p.type || "slashing"
            switch (p.category) {
               case "precision":
                  return `(${formula} + ((${formula})[precision]))[${t}]`
               case "splash":
                  return `((${formula})[splash])[${t}]`
               case "persistent":
                  return `(${formula})[persistent,${t}]`
               default:
                  return t ? `(${formula})[${t}]` : formula
            }
         })
         .filter(Boolean)

      if (!pools.length) return ""

      const parts = [pools.join(",")]

      const traits = state.traits
         ? state.traits.split(",").map((t) => t.trim())
         : []
      if (traits.length) parts.push(`traits:${traits.join(",")}`)

      const opt = []
      if (state.materials) {
         opt.push(
            ...state.materials
               .split(",")
               .map((m) => `damage:material:${m.trim()}`),
         )
      }
      if (state.options) opt.push(state.options)
      if (opt.length) parts.push(`options:${opt.join(",")}`)

      return `@Damage[${parts.join("|")}]`
   }

   static #buildTemplate(state) {
      const parts = [`type:${state.shape}`, `distance:${state.distance}`]
      if (state.shape === "line") parts.push(`width:${state.width || 5}`)
      return `@Template[${parts.join("|")}]`
   }

   static #buildRoll(state) {
      const cmd = state.isGM ? "/gmr" : "/r"
      const formula = state.rollFormula?.trim() || "1d20"
      const flavor = state.rollFlavor?.trim()
         ? ` #${state.rollFlavor.trim()}`
         : ""
      const label = state.customLabel?.trim()
         ? `{${state.customLabel.trim()}}`
         : ""
      return `[[${cmd} ${formula}${flavor}]]${label}`
   }

   static #buildAction(state) {
      const slug = state.actionSlug
      if (!slug) return ""
      const parts = [`/act ${slug}`]

      const variant = state.actionVariantType || state.actionVariant?.trim()
      if (variant) parts.push(`variant=${variant}`)

      if (state.actionDC?.trim()) parts.push(`dc=${state.actionDC.trim()}`)

      const stat = state.actionStatType || state.actionStat?.trim()
      if (stat) parts.push(`statistic=${stat}`)

      return `[[${parts.join(" ")}]]`
   }

   static #buildCondition(state) {
      if (!state.conditionId) return ""
      const val = state.conditionValue ? ` ${state.conditionValue}` : ""
      return `@UUID[Compendium.pf2e.conditionitems.Item.${state.conditionId}]{${state.conditionName}${val}}`
   }

   static async copyToClipboard(text) {
      await navigator.clipboard.writeText(text)
      ui.notifications.info(
         game.i18n.localize("PF2E-AZTECS.Notifications.Copied"),
      )
   }

   static async insertAtCursor(
      text,
      targetElement,
      selection = null,
      savedRange = null,
      autoCopy = false,
   ) {
      if (!targetElement) return this.copyToClipboard(text)

      if (
         targetElement.tagName === "TEXTAREA" ||
         targetElement.tagName === "INPUT"
      ) {
         const start = selection?.start ?? targetElement.selectionStart
         const end = selection?.end ?? targetElement.selectionEnd

         targetElement.value =
            targetElement.value.substring(0, start) +
            text +
            targetElement.value.substring(end)
         targetElement.selectionStart = targetElement.selectionEnd =
            start + text.length
         targetElement.focus()
      } else if (targetElement.isContentEditable) {
         targetElement.focus()
         if (savedRange) {
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(savedRange)
         }
         document.execCommand("insertText", false, text)
      }

      if (autoCopy) {
         await navigator.clipboard.writeText(text)
         ui.notifications.info(
            game.i18n.localize("PF2E-AZTECS.Notifications.InsertedAndCopied"),
         )
      } else {
         ui.notifications.info(
            game.i18n.localize("PF2E-AZTECS.Notifications.Inserted"),
         )
      }
   }
}
