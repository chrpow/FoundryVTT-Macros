/*
Goblin Song
This macro will make a Performance check vs the target.

Features:
* Limit the number of targets based on Performance rank and Loud Singer feat
* Check the 30ft/60 ft range limit
* Auto-fails if no shared language

Limitations:
* Does not handle assurance.
* Does not handle NOTES
*/

GoblinSong();

async function GoblinSong() {
    if (canvas.tokens.controlled.length !== 1) {
        return ui.notifications.warn('You need to select exactly one token to perform Goblin Song.');
    } else if (game.user.targets.size < 1) {
        return ui.notifications.warn(`You must target at least one token.`);
    }

    /**
     * Check whether the current actor has a feature.
     *
     * @param {string} slug
     * @returns {boolean} true if the feature exists, false otherwise
     */
    const checkFeat = (slug) =>
        token.actor.items
            .filter((item) => item.type === 'feat')
            .some((item) => item.slug === slug);

    const skillName = "Performance";
    const skillKey = "performance";
    const actionSlug = "goblin-song"
    const actionName = "Goblin Song";

    const targetProgression = new Map([
        [0, 1], //Untrained
        [1, 1], //Trained
        [2, 2], //Expert
        [3, 4], //Master
        [4, 8]  //Legendary
    ]);

    const hasGoblinSong = checkFeat("goblin-song");
    if (!hasGoblinSong) {
        return ui.notifications.warn('You do not have the Goblin Song feat');
    }
    const hasLoudSinger = checkFeat("loud-singer");

    const range = hasLoudSinger ? 30 : 60;
    const maxTargets = targetProgression.get(token.actor.skills[skillKey].rank) + hasLoudSinger;

    if (game.user.targets.size > maxTargets) {
        return ui.notifications.warn(`Your Goblin Song can\'t have more than ${maxTargets} targets.`);
    }

    const traits = ['concentrate', 'auditory', 'goblin', 'linguistic'];
    const options = [...actor.getRollOptions(['all', 'skill-check', 'perform', 'action:' + actionSlug]), ...traits];

    const traitObjects = traits.map(trait => ({ description: CONFIG.PF2E.traitsDescriptions[trait], name: trait, label: CONFIG.PF2E.actionTraits[trait] }));
    options.push('action:perform:singing');

    const languages = token.actor.system.traits.languages.value;

    const modifiers = [];
    const notes = [];

    const alwaysShowName = !game.settings.get("pf2e", "metagame_tokenSetsNameVisibility");
    for (let target of game.user.targets) {
        const showName = alwaysShowName || target.document.playersCanSeeName;

        const nameForNotifications = showName ? target.name : 'Unknown';
        const nameForChatMessage = showName ? target.name : `Unknown <span data-visibility="gm">(${target.name})</span>`;

        let distance = token.distanceTo(target);

        if (distance > range) {
            ui.notifications.warn(`${nameForNotifications} is out of range.`);
            continue;
        } else {
            // let virtuosic = new game.pf2e.Modifier(token.actor.skills[skillKey].modifiers.find(a => a.slug === 'virtuosic-performer-singing'));
            // modifiers.push(virtuosic)
            // if (virtuosic) {
            //     modifiers.push(virtuosic);
            // }

            const targetLanguages = target.actor.system.traits.languages?.value ?? [];

            if (!targetLanguages.some((lang) => languages.includes(lang))) {
                ChatMessage.create({
                    user: game.user.id,
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                    flavor: `<span class="pf2-icon">A</span> <b>${actionName}</b> - <span style="color:#FF0000;">Language Barrier</span>  <br>${nameForChatMessage} doesn\'t understand the lyrics of your Goblin Song. Nothing happens.`,
                    speaker: ChatMessage.getSpeaker(),
                    flags: {
                        "goblin-song": {
                            id: target.id,
                            demoId: token.actor.id,
                            demoName: token.name
                        }
                    }
                });
                return;
            }

            // const immunityEffect = {
            //     type: 'effect',
            //     name: 'Goblin Song Immunity',
            //     img: 'systems/pf2e/icons/spells/blind-ambition.webp',
            //     system: {
            //         tokenIcon: {
            //             show: true
            //         },
            //         duration: {
            //             value: 1,
            //             unit: 'hour',
            //             sustained: false,
            //             expiry: 'turn-start'
            //         },
            //         rules: [],
            //     },
            // };
            // check if the person being demoralized is currently immune.
            // var isImmune = target.actor.itemTypes.effect.find(obj => {
            //     return obj.name === immunityEffect.name
            // });
            // if (isImmune) {
            //     ui.notifications.warn(nameForNotifications + ` is currently immune to ${actionName}.`);
            //     continue;
            // }

            const context = {
                target: {
                    actor: target.actor.uuid.toString(),
                    token: target.document.uuid.toString()
                },
                actor: token.actor, traits: traitObjects, type: 'skill-check', options, notes, dc: { value: target.actor.system.saves.will.dc }
            };

            // ---------------------------------------------------------

            game.pf2e.Check.roll(
                new game.pf2e.CheckModifier(
                    `<span class="pf2-icon">A</span> <b>${actionName}</b> - <p class="compact-text">${skillName} Skill Check</p>`,
                    token.actor.skills.performance, modifiers), context, event,
                async (roll) => {
                    if (roll.degreeOfSuccess === 3) {
                        // crit success message
                        ChatMessage.create({
                            user: game.user.id,
                            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                            flavor: `<strong>Critical Success</strong><br> <strong>${nameForChatMessage}</strong> takes a -1 status penalty to Perception checks and Will saves for 1 minute. @UUID[Compendium.pf2e.feat-effects.Item.bIRIS6mnynr72RDw]{Goblin Song (Critical Success)}`,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "goblin-song": {
                                    id: target.id,
                                    dos: roll.degreeOfSuccess,
                                    demoId: token.actor.id,
                                    demoName: token.name
                                }
                            }
                        });
                    } else if (roll.degreeOfSuccess === 2) {
                        // success message
                        ChatMessage.create({
                            user: game.user.id,
                            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                            flavor: `<strong>Success</strong><br> <strong>${nameForChatMessage}</strong> takes a -1 status penalty to Perception checks and Will saves for 1 round. @UUID[Compendium.pf2e.feat-effects.Item.5veOBmMYQxywTudd]{Goblin Song (Success)}`,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "goblin-song": {
                                    id: target.id,
                                    dos: roll.degreeOfSuccess,
                                    demoId: token.actor.id,
                                    demoName: token.name
                                }
                            }
                        });
                    } else if (roll.degreeOfSuccess === 1) {
                        // fail message
                        ChatMessage.create({
                            user: game.user.id,
                            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                            flavor: `<strong>Failure</strong><br> Your Goblin Song doesn\'t bother ${nameForChatMessage}. Nothing happens.`,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "goblin-song": {
                                    id: target.id,
                                    dos: roll.degreeOfSuccess,
                                    demoId: token.actor.id,
                                    demoName: token.name
                                }
                            }
                        });
                    } else if (roll.degreeOfSuccess === 0) {
                        // crit fail message
                        ChatMessage.create({
                            user: game.user.id,
                            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                            flavor: `<strong>Critical Failure</strong><br> ${nameForChatMessage} is temporarily immune to attempts to use Goblin Song for 1 hour.`,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "goblin-song": {
                                    id: target.id,
                                    dos: roll.degreeOfSuccess,
                                    demoId: token.actor.id,
                                    demoName: token.name
                                }
                            }
                        });
                    }
                },
            )
        }
    }
}