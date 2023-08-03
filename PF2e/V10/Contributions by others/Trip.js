/*
Borrows heavily from @symonsch's Spellstrike macro

Select a token and target one or two enemies.
This macro will roll the trip with the appropriate MAP and appropriate weapon potency bonuses.
If the selected token has Staff Sweep, the macro will allow them to trip up to two targets provided they're wielding an eligible weapon.
*/

Trip();

async function Trip() {
    /* Throw warning if token is not selected*/
    if (canvas.tokens.controlled.length < 1) { return ui.notifications.warn('No token is selected.'); }
    if (canvas.tokens.controlled.length > 1) { return ui.notifications.warn('Only 1 token should be selected'); }
    if (game.user.targets.size < 1) { return ui.notifications.warn('Please target a token'); }
    const hasStaffSweep = token.actor.itemTypes.feat.some(e => e.slug === 'staff-sweep');
    if (game.user.targets.size > 1 && !hasStaffSweep) { return ui.notifications.warn('Trip can only affect 1 target'); }
    console.log(game.user.targets.size)
    for (let token of canvas.tokens.controlled) {
        /* Gather weapons */
        let weapons = [];
        weapons = token.actor.system.actions.filter(i => i.visible && i.type === 'strike' && !i.item.isRanged && i.item.isEquipped && !i.item.system.traits.value.includes('ranged'));
        let staves = [];
        let tripWeapons = [];
        tripWeapons = weapons.filter(i => i.item.system.traits.value.includes('trip'));
        let usingStaffSweep;
        if (hasStaffSweep) {
            staves = weapons.filter(i => i.item.system.group === 'spear' || i.item.system.group === 'polearm' || ['staff', 'bo-staff', 'halfling-sling-staff'].includes(i.item.system.slug));
            usingStaffSweep = game.user.targets.size > 1
            console.log(game.user.targets.size)
            if (usingStaffSweep && staves.length < 1) { return ui.notifications.warn('You need a staff equipped to use Staff Sweep against multiple targets') }
            if (usingStaffSweep && game.user.targets.size > 2) { return ui.notifications.warn('Staff Sweep can only affect 2 targets'); }
            console.log(game.user.targets.size)
        }
        let trippers = [...tripWeapons, ...staves];
        for (var i = 0; i < trippers.length; ++i) {
            for (var j = i + 1; j < trippers.length; ++j) {
                if (trippers[i] === trippers[j]) { trippers.splice(j--, 1); }
            }
        }

        let map_weap = trippers.map(p => p.label);

        if (token.actor.system.attributes.handsFree > 0) {
            map_weap.push('Free Hand')
        }

        /* Build dialog data */
        const es_data = [
            { label: `Targets:`, type: `info` },
            { label: `Weapon:`, type: `select`, options: map_weap },
            { label: `MAP`, type: `select`, options: [0, 1, 2] }
        ];

        /* Run dialog and alot data */
        const choice = await quickDialog({ data: es_data, title: `Trip` });
        choice.splice(0, 1);

        /* Get the strike actions */
        if (choice[0] != 'Free Hand') { var potency = weapons.find(a => a.label === choice[0]).modifiers.filter(m => m.label.toLowerCase().includes('potency'))[0]; }

        const ts = new Set(game.user.targets)
        console.log(`ts: ${ts}`)

        const originalTargets = [];
        /* Trip all target(s) */
        try {
            ts.forEach(target => {
                originalTargets.push(target.id)
                target.setTarget({ targeted: true });

                /* Calculate MAP */
                const mapMod = -5 * choice[1];

                const map = new game.pf2e.Modifier({
                    slug: "Multiple Attack Penalty",
                    label: 'PF2E.MultipleAttackPenalty',
                    modifier: mapMod,
                    type: "untyped"
                })
                const tripMod = [];
                if (map.modifier) { tripMod.push(map); }
                if (potency?.modifier) { tripMod.push(potency) }

                /* Execute Trip */
                game.pf2e.actions.trip({
                    actors: [token.actor],
                    modifiers: tripMod
                })
            })
        }
        /* In case of error, restore original targets */
        catch { game.user.updateTokenTargets(originalTargets) }
        console.log(originalTargets)


        // /* Restore original targets */
        game.user.updateTokenTargets(originalTargets)
    }
}


/* Dialog box */
async function quickDialog({ data, title = `Quick Dialog` } = {}) {
    data = data instanceof Array ? data : [data];
    let arr = Array.from(game.user.targets);
    let tars = ''
    for (a in arr) {
        tars = tars.concat(`<p>${arr[a].name}</p>`)
    }

    return await new Promise(async (resolve) => {
        let content = `
      <table style="width:100%">
      ${data.map(({ type, label, options }, i) => {
            if (type.toLowerCase() === `select`) {
                return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><select style="font-size:12px" id="${i}qd">${options.map((e, i) => `<option value="${e}">${e}</option>`).join(``)}</td></tr>`;
            }
            else if (type.toLowerCase() === `checkbox`) {
                return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><input type="${type}" id="${i}qd" ${options || ``}/></td></tr>`;
            }
            else if (type.toLowerCase() === `info`) {
                return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%">${tars || ``}</td></tr>`;
            }
            else {
                return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><input type="${type}" id="${i}qd" value="${options instanceof Array ? options[0] : options}"/></td></tr>`;
            }
        }).join(``)}
      </table>`;

        await new Dialog({
            title, content,
            buttons: {
                Ok: {
                    label: `Ok`, callback: (html) => {
                        resolve(Array(data.length).fill().map((e, i) => {
                            let { type } = data[i];
                            if (type.toLowerCase() === `select`) {
                                return html.find(`select#${i}qd`).val();
                            }
                            else {
                                switch (type.toLowerCase()) {
                                    case `text`:
                                    case `password`:
                                    case `radio`:
                                        return html.find(`input#${i}qd`)[0].value;
                                    case `checkbox`:
                                        return html.find(`input#${i}qd`)[0].checked;
                                    case `number`:
                                        return html.find(`input#${i}qd`)[0].valueAsNumber;
                                }
                            }
                        }));
                    }
                }
            },
            default: 'Ok'
        }, { width: "auto" })._render(true);
        // document.getElementById("0qd").focus();
    });
}