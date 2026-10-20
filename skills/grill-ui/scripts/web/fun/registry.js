// Every fun-mode scene. The engine loads `bg/<id>.js` or `game/<id>.js` on demand and skips ids
// whose file isn't there yet. Owned by the engine: scene authors don't edit this.
//
// Games:
//   trigger  'random'  picked by the scheduler (about 1 in 4 questions, never twice in a row)
//            'answer'  may play when you submit an answer (about 1 in 3)
//            'always'  mounted for as long as fun mode is on (watches behaviour, shows toasts)
//   ms       expected length. The engine ends a game that runs past 3x this (min 20s).
//   passive  lives until it ends itself (no time cap) and doesn't block other games
//   keys     needs the keyboard, so it only starts when the answer box is empty and you've stopped typing
//   still    allowed under prefers-reduced-motion (it must then skip its motion)

export const scenes = [
  // backgrounds that use your question, options or decisions
  { id: 'matrix', kind: 'bg', name: 'Matrix rain' },
  { id: 'meme-board', kind: 'bg', name: 'Meme board' },
  { id: 'conspiracy', kind: 'bg', name: 'Conspiracy wall' },
  { id: 'departures', kind: 'bg', name: 'Departures board' },
  { id: 'breaking-news', kind: 'bg', name: 'Breaking news' },
  { id: 'trading-floor', kind: 'bg', name: 'Trading floor' },
  { id: 'group-chat', kind: 'bg', name: 'Group chat' },
  { id: 'linkedin', kind: 'bg', name: 'LinkedIn feed' },
  { id: 'ouija', kind: 'bg', name: 'Ouija board' },
  { id: 'sports', kind: 'bg', name: 'Sports broadcast' },
  { id: 'courtroom', kind: 'bg', name: 'Courtroom sketch' },
  { id: 'nature-doc', kind: 'bg', name: 'Nature documentary' },
  { id: 'slot-machine', kind: 'bg', name: 'Slot machine' },
  { id: 'ransom-note', kind: 'bg', name: 'Ransom note' },
  { id: 'times-square', kind: 'bg', name: 'Times Square' },
  { id: 'mission-control', kind: 'bg', name: 'Mission control' },
  { id: 'win95', kind: 'bg', name: 'Windows 95 meltdown' },
  // mood pieces
  { id: 'bbq', kind: 'bg', name: 'The grill' },
  { id: 'synthwave', kind: 'bg', name: 'Synthwave' },
  { id: 'lofi', kind: 'bg', name: 'Lofi beats to decide to' },
  { id: 'lava-lamp', kind: 'bg', name: 'Lava lamp' },
  { id: 'hyperspace', kind: 'bg', name: 'Hyperspace' },
  { id: 'dvd', kind: 'bg', name: 'Bouncing logo' },
  { id: 'aquarium', kind: 'bg', name: 'Aquarium' },
  { id: 'silent-film', kind: 'bg', name: 'Silent film' },
  { id: 'disco', kind: 'bg', name: 'Disco' },
  { id: 'snow-globe', kind: 'bg', name: 'Snow globe' },
  // backgrounds you can play with
  { id: 'bubble-wrap', kind: 'bg', name: 'Bubble wrap' },
  { id: 'zen-garden', kind: 'bg', name: 'Zen garden' },
  { id: 'cat-wall', kind: 'bg', name: 'Cat wall' },

  // games
  { id: 'pigeon', kind: 'game', name: 'Clay pigeon', trigger: 'random', ms: 9000 },
  { id: 'unicorn', kind: 'game', name: 'Unicorn', trigger: 'answer', ms: 2500 },
  { id: 'snake', kind: 'game', name: 'Snake', trigger: 'random', ms: 12000, keys: true },
  { id: 'goose', kind: 'game', name: 'Goose', trigger: 'random', ms: 7000 },
  { id: 'moles', kind: 'game', name: 'Whack-a-mole', trigger: 'random', ms: 9000 },
  { id: 'bug', kind: 'game', name: 'Bug on the card', trigger: 'random', ms: 6000 },
  { id: 'stapler', kind: 'game', name: 'Desk assistant', trigger: 'random', ms: 8000 },
  { id: 'googly', kind: 'game', name: 'Googly eyes', trigger: 'random', passive: true },
  { id: 'gravity', kind: 'game', name: 'Gravity off', trigger: 'random', ms: 5000 },
  { id: 'pinata', kind: 'game', name: 'Piñata', trigger: 'random', ms: 7000 },
  { id: 'balloons', kind: 'game', name: 'Balloons', trigger: 'random', ms: 9000 },
  { id: 'achievements', kind: 'game', name: 'Achievements', trigger: 'always', still: true },
  { id: 'cat', kind: 'game', name: 'Cat', trigger: 'random', passive: true },
  { id: 'fortune', kind: 'game', name: 'Fortune cookie', trigger: 'random', ms: 6000 },
];

export const byId = new Map(scenes.map((s) => [`${s.kind}:${s.id}`, s]));
