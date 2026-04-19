import { PF2eInlineLogic } from "./logic.js"
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class PF2eInlineBuilderUI extends HandlebarsApplicationMixin(
   ApplicationV2,
) {
   static ALL_STATS = [
      { key: "ac", label: "AC" },
      { key: "perception", label: "Perception" },
      { key: "fortitude", label: "Fortitude" },
      { key: "reflex", label: "Reflex" },
      { key: "will", label: "Will" },
      { key: "class-spell", label: "Class or Spell DC" },
      { key: "class", label: "Class DC" },
      { key: "spell", label: "Spell DC" },
   ]

   static ACTION_STATS_OTHER = [
      { key: "perception", label: "Perception" },
      { key: "fortitude", label: "Fortitude" },
      { key: "reflex", label: "Reflex" },
      { key: "will", label: "Will" },
      { key: "ac", label: "Armor Class (AC)" },
      { key: "class-spell", label: "Class or Spell DC" },
      {
         key: "resolve(@actor.attributes.classDC.value)",
         label: "Class DC (Resolved)",
      },
      {
         key: "resolve(@actor.attributes.spellDC.value)",
         label: "Spell DC (Resolved)",
      },
   ]

   static DEFAULT_OPTIONS = {
      id: "pf2e-aztecs-inline-builder",
      classes: ["pf2e-inline-builder"],
      position: { width: 480, height: "auto" },
      window: {
         icon: "fa-solid fa-hammer",
         resizable: false,
         minimizable: true,
      },
      actions: {
         copy: this.onCopy,
         insert: this.onInsert,
         addDamage: this.onAddDamageRow,
         removeDamage: this.onRemoveDamageRow,
         addCheckKey: this.onAddCheckKey,
         removeCheckKey: this.onRemoveCheckKey,
         addSaveKey: this.onAddSaveKey,
         removeSaveKey: this.onRemoveSaveKey,
         addResolveArg: this.onAddResolveArg,
         removeResolveArg: this.onRemoveResolveArg,
      },
   }

   static PARTS = {
      form: {
         template: "modules/pf2e-aztecs-inline-builder/templates/builder.hbs",
      },
   }

   constructor(options = {}) {
      options.position = options.position || {}
      options.position.top = options.position.top ?? 15
      options.position.left = options.position.left ?? window.innerWidth - 495

      super(options)

      this.targetElement = null
      this.savedSelection = null
      this.savedRange = null

      this.#captureTarget(options.targetElement || document.activeElement)
      this._selectionListener = this.#onSelectionChange.bind(this)
      document.addEventListener("selectionchange", this._selectionListener)

      this.saves = Object.entries(CONFIG.PF2E.saves).map(([k, v]) => ({
         key: k,
         label: game.i18n.localize(v.label || v),
      }))

      this.skills = Object.entries(CONFIG.PF2E.skills).map(([k, v]) => ({
         key: k,
         label: game.i18n.localize(v.label || v),
      }))
      this.skills.push({
         key: "perception",
         label: game.i18n.localize("PF2E.PerceptionLabel"),
      })
      this.skills.sort((a, b) => a.label.localeCompare(b.label))

      this.damageTypes = CONFIG.PF2E.damageTypes

      this.actions = Array.from(game.pf2e.actions.values())
         .map((a) => {
            const variantsMap = a.variants || new Map()
            const variants = Array.from(variantsMap.values()).map((v) => ({
               key: v.slug,
               label: game.i18n.localize(v.name || v.label || v.slug),
            }))

            return {
               key: a.slug,
               label: game.i18n.localize(a.name),
               variants,
            }
         })
         .sort((a, b) => a.label.localeCompare(b.label))

      this.formData = this.#getDefaultData()
   }

   #captureTarget(target) {
      if (!target) return
      const isInput =
         target.tagName === "INPUT" ||
         target.tagName === "TEXTAREA" ||
         target.isContentEditable
      if (!isInput) return

      if (target.closest && target.closest(".pf2e-inline-builder")) return

      this.targetElement = target

      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
         try {
            this.savedSelection = {
               start: target.selectionStart || 0,
               end: target.selectionEnd || 0,
            }
         } catch (e) {
            this.savedSelection = { start: 0, end: 0 }
         }
      }

      if (target.isContentEditable) {
         const sel = window.getSelection()
         if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            if (target.contains(range.commonAncestorContainer)) {
               this.savedRange = range.cloneRange()
            }
         }
      }
   }

   #onSelectionChange() {
      this.#captureTarget(document.activeElement)
   }

   async close(options) {
      document.removeEventListener("selectionchange", this._selectionListener)
      return super.close(options)
   }

   #getDefaultData() {
      return {
         type: "Check",
         checkKeys: ["athletics"],
         checkAdjTypes: [""],
         checkAdjValues: [""],
         saveKeys: ["fortitude"],
         saveAdjTypes: [""],
         saveAdjValues: [""],
         dcMode: "dc",
         dc: "20",
         againstType: "class-spell",
         against: "",
         defenseType: "perception",
         defense: "",
         isLevelDC: false,
         isResolve: false,
         resolveOp: "none",
         resolveArgs: [""],
         showDC: "owner",
         rollerRole: "",
         basicSave: false,
         isSecret: false,
         immutable: false,
         overrideTraits: false,
         traits: "",
         options: "",
         damagePools: [
            {
               diceCount: "",
               diceFaces: "",
               fixedValue: "",
               type: "slashing",
               category: "",
            },
         ],
         materials: "",
         shape: "burst",
         distance: 20,
         width: "5",
         customLabel: "",
         rollFormula: "1d4",
         rollFlavor: "",
         isGM: false,
         actionSlug: "administer-first-aid",
         actionVariantType: "",
         actionVariant: "",
         actionDC: "",
         actionStatType: "",
         actionStat: "",
         conditionId: "",
         conditionValue: "",
         conditionName: "",
         chatCardName: "",
      }
   }

   async _prepareContext(options) {
      if (!this.conditions) {
         const pack = game.packs.get("pf2e.conditionitems")
         const index = await pack.getIndex({ fields: ["img"] })
         this.conditions = Array.from(index)
            .map((c) => ({
               id: c._id,
               name: c.name,
               img: c.img,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
         if (!this.formData.conditionId)
            this.formData.conditionId = this.conditions[0]?.id
      }

      const selectedCondition = this.conditions.find(
         (c) => c.id === this.formData.conditionId,
      )
      this.formData.conditionName = selectedCondition
         ? selectedCondition.name
         : "Condition"

      const selectedAction = this.actions.find(
         (a) => a.key === this.formData.actionSlug,
      )
      const currentVariants = selectedAction ? selectedAction.variants : []

      const checkKeysMapped = this.formData.checkKeys.map((val, idx) => ({
         value: val,
         index: idx,
         adjType: this.formData.checkAdjTypes[idx] || "",
         adjValue: this.formData.checkAdjValues[idx] || "",
         canRemove: this.formData.checkKeys.length > 1,
      }))
      const saveKeysMapped = this.formData.saveKeys.map((val, idx) => ({
         value: val,
         index: idx,
         adjType: this.formData.saveAdjTypes[idx] || "",
         adjValue: this.formData.saveAdjValues[idx] || "",
         canRemove: this.formData.saveKeys.length > 1,
      }))
      const damagePoolsMapped = this.formData.damagePools.map((val, idx) => ({
         ...val,
         index: idx,
         canRemove: this.formData.damagePools.length > 1,
      }))

      const resolveArgsMapped = this.formData.resolveArgs.map((val, idx) => ({
         value: val,
         index: idx,
         label: `Value ${idx + 1}`,
         canRemove:
            (this.formData.resolveOp === "max" ||
               this.formData.resolveOp === "min") &&
            this.formData.resolveArgs.length > 2,
      }))
      const canAddResolveArg =
         this.formData.resolveOp === "max" || this.formData.resolveOp === "min"

      const commonPaths = [
         "@actor.level",
         "@item.level",
         "@actor.attributes.classDC.value",
         "@actor.attributes.spellDC.value",
         "@actor.attributes.classOrSpellDC.value",
         "@actor.attributes.hp.value",
         "@actor.attributes.hp.max",
         "@actor.attributes.ac.value",
         "@actor.attributes.perception.value",
         "@actor.saves.fortitude.value",
         "@actor.skills.athletics.value",
         "@actor.abilities.str.mod",
         "@actor.attributes.speed.value",
         "@actor.attributes.reach.value",
         "@actor.initiative.value",
         "@actor.resources.focus.value",
         "@actor.resources.focus.max",
         "@actor.resources.heroPoints.value",
         "@actor.inventory.bulk.value",
         "@actor.system.traits.size.value",
      ]

      const resolveOpTooltip = game.i18n.localize(
         `PF2E-AZTECS.Tooltips.Resolve.${this.formData.resolveOp}`,
      )

      return {
         ...(await super._prepareContext(options)),
         ...this.formData,
         checkKeysMapped,
         saveKeysMapped,
         damagePoolsMapped,
         resolveArgsMapped,
         canAddResolveArg,
         commonPaths,
         resolveOpTooltip,
         saves: this.saves,
         skills: this.skills,
         actions: this.actions,
         currentVariants,
         conditions: this.conditions,
         selectedCondition,
         allStats: PF2eInlineBuilderUI.ALL_STATS,
         actionStatsOther: PF2eInlineBuilderUI.ACTION_STATS_OTHER,
         damageTypes: this.damageTypes,
         preview: PF2eInlineLogic.buildSyntax(this.formData),
      }
   }

   _onRender(context, options) {
      super._onRender(context, options)
      const html = $(this.element)
      const form = html.find("form")

      this.#syncVisibility(form)

      html
         .off(".pf2e-builder")
         .on(
            "input.pf2e-builder change.pf2e-builder",
            "input, select, textarea",
            (event) => {
               const target = event.currentTarget
               const { name, value, type, checked } = target
               const val = type === "checkbox" ? checked : value

               if (name === "isLevelDC" && checked) {
                  this.formData.isResolve = false
                  html.find('input[name="isResolve"]').prop("checked", false)
               }
               if (name === "isResolve" && checked) {
                  this.formData.isLevelDC = false
                  html.find('input[name="isLevelDC"]').prop("checked", false)
               }

               if (name.startsWith("damagePools.")) {
                  const [, index, field] = name.split(".")
                  this.formData.damagePools[parseInt(index, 10)][field] = val
               } else if (name.startsWith("checkKeys.")) {
                  this.formData.checkKeys[parseInt(name.split(".")[1], 10)] =
                     val
               } else if (name.startsWith("checkAdjTypes.")) {
                  this.formData.checkAdjTypes[
                     parseInt(name.split(".")[1], 10)
                  ] = val
               } else if (name.startsWith("checkAdjValues.")) {
                  this.formData.checkAdjValues[
                     parseInt(name.split(".")[1], 10)
                  ] = val
               } else if (name.startsWith("saveKeys.")) {
                  this.formData.saveKeys[parseInt(name.split(".")[1], 10)] = val
               } else if (name.startsWith("saveAdjTypes.")) {
                  this.formData.saveAdjTypes[parseInt(name.split(".")[1], 10)] =
                     val
               } else if (name.startsWith("saveAdjValues.")) {
                  this.formData.saveAdjValues[
                     parseInt(name.split(".")[1], 10)
                  ] = val
               } else if (name.startsWith("resolveArgs.")) {
                  this.formData.resolveArgs[parseInt(name.split(".")[1], 10)] =
                     val
               } else {
                  this.formData[name] = val
               }

               if (name === "resolveOp") {
                  if (
                     val === "none" ||
                     val === "abs" ||
                     val === "floor" ||
                     val === "ceil" ||
                     val === "round"
                  ) {
                     this.formData.resolveArgs = [
                        this.formData.resolveArgs[0] || "",
                     ]
                  } else if (val === "max" || val === "min") {
                     if (this.formData.resolveArgs.length < 2) {
                        this.formData.resolveArgs.push("")
                     }
                  } else if (val === "ternary") {
                     while (this.formData.resolveArgs.length < 3)
                        this.formData.resolveArgs.push("")
                     this.formData.resolveArgs =
                        this.formData.resolveArgs.slice(0, 3)
                  }
                  this.render()
                  return
               }

               if (name.startsWith("checkAdjTypes.")) {
                  const idx = name.split(".")[1]
                  if (val !== "") {
                     this.formData.checkAdjValues[idx] = ""
                     html.find(`input[name="checkAdjValues.${idx}"]`).val("")
                  }
               } else if (name.startsWith("checkAdjValues.")) {
                  const idx = name.split(".")[1]
                  if (val !== "") {
                     this.formData.checkAdjTypes[idx] = ""
                     html.find(`select[name="checkAdjTypes.${idx}"]`).val("")
                  }
               } else if (name.startsWith("saveAdjTypes.")) {
                  const idx = name.split(".")[1]
                  if (val !== "") {
                     this.formData.saveAdjValues[idx] = ""
                     html.find(`input[name="saveAdjValues.${idx}"]`).val("")
                  }
               } else if (name.startsWith("saveAdjValues.")) {
                  const idx = name.split(".")[1]
                  if (val !== "") {
                     this.formData.saveAdjTypes[idx] = ""
                     html.find(`select[name="saveAdjTypes.${idx}"]`).val("")
                  }
               }

               if (name === "conditionId") {
                  const selectedCondition = this.conditions.find(
                     (c) => c.id === val,
                  )
                  if (selectedCondition) {
                     this.formData.conditionName = selectedCondition.name
                     html
                        .find(".show-condition img")
                        .attr("src", selectedCondition.img)
                  }
               }

               if (name === "type") {
                  Object.assign(this.formData, this.#getDefaultData())
                  this.formData.type = val
                  this.render()
                  return
               }

               if (name === "actionSlug") {
                  const selectedAction = this.actions.find((a) => a.key === val)
                  const variants = selectedAction ? selectedAction.variants : []

                  if (variants.length > 0) {
                     const variantSelect = html.find(
                        'select[name="actionVariantType"]',
                     )
                     variantSelect
                        .empty()
                        .append('<option value="">None</option>')
                     variants.forEach((v) => {
                        variantSelect.append(
                           `<option value="${v.key}">${v.label}</option>`,
                        )
                     })
                  }

                  this.formData.actionVariantType = ""
                  this.formData.actionVariant = ""
                  html.find('input[name="actionVariant"]').val("")
                  this.render()
                  return
               }

               this.#handleInterlock(form, "against", "againstType", name)
               this.#handleInterlock(form, "defense", "defenseType", name)
               this.#handleInterlock(
                  form,
                  "actionVariant",
                  "actionVariantType",
                  name,
               )
               this.#handleInterlock(form, "actionStat", "actionStatType", name)

               this.#syncVisibility(form)
               this.#updatePreview(html)
            },
         )
   }

   /* Action handlers */
   static onAddDamageRow(event, target) {
      this.formData.damagePools.push({
         diceCount: "",
         diceFaces: "",
         fixedValue: "",
         type: "slashing",
         category: "",
      })
      this.render()
   }
   static onRemoveDamageRow(event, target) {
      this.formData.damagePools.splice(parseInt(target.dataset.index, 10), 1)
      this.render()
   }

   static onAddCheckKey(event, target) {
      this.formData.checkKeys.push("athletics")
      this.formData.checkAdjTypes.push("")
      this.formData.checkAdjValues.push("")
      this.render()
   }
   static onRemoveCheckKey(event, target) {
      const idx = parseInt(target.dataset.index, 10)
      this.formData.checkKeys.splice(idx, 1)
      this.formData.checkAdjTypes.splice(idx, 1)
      this.formData.checkAdjValues.splice(idx, 1)
      this.render()
   }

   static onAddSaveKey(event, target) {
      this.formData.saveKeys.push("fortitude")
      this.formData.saveAdjTypes.push("")
      this.formData.saveAdjValues.push("")
      this.render()
   }
   static onRemoveSaveKey(event, target) {
      const idx = parseInt(target.dataset.index, 10)
      this.formData.saveKeys.splice(idx, 1)
      this.formData.saveAdjTypes.splice(idx, 1)
      this.formData.saveAdjValues.splice(idx, 1)
      this.render()
   }

   static onAddResolveArg(event, target) {
      this.formData.resolveArgs.push("")
      this.render()
   }
   static onRemoveResolveArg(event, target) {
      const idx = parseInt(target.dataset.index, 10)
      this.formData.resolveArgs.splice(idx, 1)
      this.render()
   }

   static async onCopy(event, target) {
      const text = $(this.element).find('textarea[name="preview"]').val()
      await PF2eInlineLogic.copyToClipboard(text)

      if (game.settings.get("pf2e-aztecs-inline-builder", "closeOnCopy")) {
         this.close()
      }
   }

   static async onInsert(event, target) {
      const text = $(this.element).find('textarea[name="preview"]').val()
      const autoCopy = game.settings.get(
         "pf2e-aztecs-inline-builder",
         "autoCopyOnInsert",
      )

      await PF2eInlineLogic.insertAtCursor(
         text,
         this.targetElement,
         this.savedSelection,
         this.savedRange,
         autoCopy,
      )

      if (game.settings.get("pf2e-aztecs-inline-builder", "closeOnInsert")) {
         this.close()
      }
   }

   /* Private Helpers */
   #handleInterlock(form, inputName, selectName, triggerName) {
      if (triggerName === inputName) {
         if (this.formData[inputName] !== "") {
            form.find(`select[name="${selectName}"]`).val("")
            this.formData[selectName] = ""
         }
      } else if (triggerName === selectName) {
         if (this.formData[selectName] !== "") {
            form.find(`input[name="${inputName}"]`).val("")
            this.formData[inputName] = ""
         }
      }
   }

   #syncVisibility(form) {
      const { type, dcMode, shape, isLevelDC, isResolve } = this.formData
      form.attr({
         "data-type": type,
         "data-dc-mode": dcMode,
         "data-shape": shape,
         "data-level-dc": isLevelDC,
         "data-resolve": isResolve,
      })
      form.attr("data-has-lore", this.formData.checkKeys.includes("lore"))
   }

   #updatePreview(html) {
      html
         .find('textarea[name="preview"]')
         .val(PF2eInlineLogic.buildSyntax(this.formData))
   }
}
