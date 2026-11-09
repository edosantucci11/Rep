// "How to do it" in English (same movement patterns as howto.js). Loaded by i18n.js for every language except Italian.

export const EQ = {
  barbell: 'the barbell', dumbbell: 'the dumbbells', kettlebell: 'the kettlebell', cable: 'the cable handle',
  band: 'the band', ball: 'the medicine ball', machine: 'the machine handles', none: '',
};

const MUSCLE = {
  Petto: 'chest', Dorso: 'back', Lombari: 'lower back', Spalle: 'shoulders', Bicipiti: 'biceps', Tricipiti: 'triceps',
  Avambracci: 'forearms', Trapezi: 'traps', Collo: 'neck', Quadricipiti: 'quads', Femorali: 'hamstrings', Glutei: 'glutes',
  Abduttori: 'abductors', Adduttori: 'adductors', Polpacci: 'calves', Addome: 'abs', Cardio: 'body', Altro: 'area',
};

export const T = {
  squat: (e) => ({
    steps: [
      `Stand with feet shoulder-width apart and toes slightly out${e.load === 'barbell' ? ', the barbell resting on your traps' : e.load === 'dumbbell' ? ', a dumbbell in each hand at your sides' : e.load === 'kettlebell' ? ', the kettlebell held at your chest' : ', arms forward for balance'}.`,
      'Breathe in, brace your abs and glutes and keep your back neutral.',
      'Go down by pushing your hips back and bending your knees, which track over your toes.',
      'Reach at least thighs parallel to the floor, heels always down.',
      'Drive up through your whole foot and breathe out on the way up.',
    ],
    tips: ["Don't let your knees cave in.", 'Eyes forward, chest up: your back must not round.'],
  }),
  rdl: (e) => ({
    steps: [
      `Stand with feet hip-width apart, ${e.eq || 'the weight'} in front of your thighs.`,
      'Unlock your knees slightly and keep them that way throughout.',
      'Push your hips back and lower the weight along your legs, back straight.',
      'Go down until you feel your hamstrings stretch (about mid-shin).',
      'Come up by driving your hips forward and squeezing your glutes.',
    ],
    tips: ['Keep the weight close to your legs at all times.', "Your back doesn't round: if it does, shorten the range."],
  }),
  deadlift: (e) => ({
    steps: [
      `Feet hip-width apart, ${e.eq || 'the barbell'} over mid-foot.`,
      'Bend down and grab the weight just outside your legs, arms straight.',
      'Chest up, back neutral, shoulders over the bar: breathe in and brace.',
      'Push the floor away with your legs and bring the weight up along your legs until standing.',
      'Lower with control, pushing your hips back first, then bending your knees.',
    ],
    tips: ["Don't pull with a rounded back.", 'Keep the bar in contact with your legs.'],
  }),
  goodmorning: () => ({
    steps: [
      'Stand with the barbell on your traps, feet hip-width apart.',
      'Knees slightly bent, abs braced.',
      'Push your hips back and tilt your torso forward with a straight back.',
      'Go down to almost parallel, then come up squeezing glutes and hamstrings.',
    ],
    tips: ["Use moderate loads: it's a control exercise.", 'Never round your lower back.'],
  }),
  lunge: (e) => ({
    steps: [
      `Stand tall${e.eq ? `, holding ${e.eq}` : ''}, torso upright and abs braced.`,
      e.opt.bulgarian ? 'Rest the top of your back foot on a bench behind you.' : 'Take a long step forward (or back) with one leg.',
      'Lower by bending both knees to about 90°, back knee close to the floor.',
      'The front knee stays over the foot, not too far past the toes.',
      'Push through the front heel to come back up. Finish the reps and switch legs.',
    ],
    tips: ['Upright torso for quads, slightly forward for glutes.', "Don't let the knee cave in."],
  }),
  stepup: (e) => ({
    steps: [
      `Stand in front of a sturdy box${e.eq ? ` holding ${e.eq}` : ''}.`,
      'Place your whole foot on the box.',
      'Push with the leg on the box and step up until it is straight, without pushing off with the other.',
      'Step down with control and repeat; then switch legs.',
    ],
    tips: ['The higher the box, the more your glutes work.', 'Knee in line with your foot.'],
  }),
  legpress: () => ({
    steps: [
      'Sit with your back and hips flat against the backrest.',
      'Feet on the platform shoulder-width apart, at mid-height.',
      'Release the weight and bend your knees toward your chest without lifting your hips.',
      'Push the platform with your whole foot until your legs are almost straight.',
    ],
    tips: ["Don't fully lock your knees at the top.", 'If your hips lift off the seat, shorten the range.'],
  }),
  legext: () => ({
    steps: [
      'Adjust the machine: knees in line with the pivot and pad above your ankles.',
      'Sit with your back supported and hold the handles.',
      'Straighten your legs all the way up, squeezing your quads.',
      'Pause for a moment and lower slowly.',
    ],
    tips: ['Controlled movement, no swinging.', "Don't lift your hips off the seat."],
  }),
  legcurl: (e) => ({
    steps: [
      e.opt.seated ? 'Sit on the machine with the pad behind your ankles and the top pad on your thighs.' : 'Lie face down on the machine, pad above your heels and knees just off the bench.',
      'Hold the handles and brace your abs.',
      'Bend your knees, bringing your heels toward your glutes.',
      'Return slowly to the start without snapping your legs straight.',
    ],
    tips: ["Keep your hips still: don't lift them.", 'The slow return is the most effective part.'],
  }),
  calf: (e) => ({
    steps: [
      e.opt.seated ? 'Sit with the balls of your feet on the platform and the pad over your knees.' : `Stand${e.eq ? ` holding ${e.eq}` : ''}, balls of your feet on a step and heels free.`,
      'Let your heels drop below your toes to stretch your calves.',
      'Rise onto your toes as high as you can.',
      'Hold the squeeze for a second, then lower slowly.',
    ],
    tips: ['Full range, no bouncing.', 'Knees still: only the ankle works.'],
  }),
  hipthrust: (e) => ({
    steps: [
      e.opt.floor || e.load !== 'barbell' ? 'Lie on your back, knees bent and feet on the floor close to your glutes.' : 'Rest your upper back on a bench, barbell over your hips.',
      'Feet hip-width apart, shins vertical at the top.',
      'Drive through your heels and lift your hips until shoulders, hips and knees line up.',
      'Squeeze your glutes hard at the top, then lower with control.',
    ],
    tips: ['Chin slightly tucked: avoid arching your back.', 'Push through your heels, not your toes.'],
  }),
  backext: (e) => ({
    steps: [
      e.opt.floor ? 'Lie face down, arms stretched forward.' : 'Set up on the back extension bench with the pad under your hips and heels locked.',
      e.opt.floor ? 'Lift your arms, chest and legs off the floor together.' : 'Start with your torso bent down and your back neutral.',
      e.opt.floor ? 'Hold for a moment, squeezing glutes and lower back.' : 'Come up until torso and legs line up, squeezing glutes and lower back.',
      'Lower slowly.',
    ],
    tips: ["Don't go past your body line at the top.", 'Slow, controlled movement.'],
  }),
  nordic: () => ({
    steps: [
      'Kneel on a mat with your ankles held by a partner or anchor.',
      'Torso upright, hips extended and abs braced.',
      'Lean forward slowly, braking with your hamstrings.',
      "When you can't hold it any longer, catch yourself with your hands and push back up.",
    ],
    tips: ['Keep your body in line from knees to head.', "It's very intense: start with few reps."],
  }),
  glutekick: (e) => ({
    steps: [
      'Get on all fours: hands under shoulders and knees under hips.',
      e.load === 'cable' ? 'Attach the ankle strap to the low cable.' : 'Brace your abs to keep your back neutral.',
      'Push one leg back and up, squeezing the glute.',
      'Lower with control. Finish the reps and switch legs.',
    ],
    tips: ["Don't arch your back to go higher.", 'Your hips stay still and level with the floor.'],
  }),
  bench: (e) => {
    if (e.opt.machine || (e.load === 'machine' && !e.opt.incline && !e.opt.decline)) {
      return {
        steps: ['Adjust the seat so the handles are at chest height.', 'Back supported and shoulder blades pinched.', 'Push the handles forward until your arms are almost straight.', 'Come back slowly until you feel your chest stretch.'],
        tips: ["Don't lift your back off the pad.", 'Elbows at about 45° from your torso.'],
      };
    }
    return {
      steps: [
        `Lie on the${e.opt.incline ? ' incline (30-45°)' : e.opt.decline ? ' decline' : ''} bench${e.opt.floor ? ' (or the floor)' : ''}${e.load === 'barbell' || e.load === 'none' ? ': eyes under the bar,' : ','} feet planted on the floor.`,
        `Grab ${e.eq || 'the barbell'} just wider than shoulder width and pinch your shoulder blades.`,
        'Bring the weight over your chest with straight arms.',
        'Lower with control until it touches your chest, elbows at about 45° from your torso.',
        'Press up until your arms are straight and breathe out.',
      ],
      tips: ['Keep glutes and shoulder blades on the bench.', 'Wrists straight, over your elbows.'],
    };
  },
  pushup: (e) => ({
    steps: [
      `Hands on the floor slightly wider than your shoulders${e.opt.incline ? ', resting on a raised surface' : ''}${e.opt.decline ? ', feet on a raised surface' : ''}.`,
      'Body in a straight line from head to heels, abs and glutes tight.',
      'Bend your elbows and lower until your chest nearly touches the floor.',
      'Push back up to straight arms.',
    ],
    tips: ["Don't let your hips sag.", 'Elbows at about 45° from your torso, not flared in a T.'],
  }),
  dip: () => ({
    steps: [
      'Grab the bars and lift yourself up with straight arms.',
      'Lean your torso slightly forward (more chest) or keep it upright (more triceps).',
      'Bend your elbows and lower until your shoulders reach elbow height.',
      'Push back up without snapping your elbows locked.',
    ],
    tips: ['Shoulders down and away from your ears.', 'If your shoulders hurt, go less deep.'],
  }),
  ohpress: (e) => ({
    steps: [
      `${e.opt.seated || e.load === 'machine' ? 'Sit with your back supported' : 'Stand with feet hip-width apart'}, ${e.eq || 'the weight'} at shoulder height.`,
      "Brace your abs and glutes so your back doesn't arch.",
      'Press the weight up until your arms are straight overhead.',
      'Lower with control back to shoulder height.',
    ],
    tips: ['Forearms vertical under the weight.', "Don't push your head forward: the weight moves past your face."],
  }),
  jerk: (e) => ({
    steps: [
      `${e.eq ? e.eq.charAt(0).toUpperCase() + e.eq.slice(1) : 'The barbell'} resting on the front of your shoulders, elbows forward.`,
      'Dip your legs a few centimeters with an upright torso.',
      'Drive your legs explosively and use the push to send the weight overhead.',
      'Lock your arms out, stabilize, then bring the weight back to your shoulders.',
    ],
    tips: ['The dip is short and fast.', 'Your head "goes through" under the bar at the end of the drive.'],
  }),
  row: (e) => ({
    steps: [
      e.opt.one ? 'Rest the hand and knee of the same side on a bench; the other hand holds the weight.' : `Stand holding ${e.eq || 'the barbell'}, knees slightly bent.`,
      'Lean your torso forward (about 45°) with a straight back.',
      'Pull the weight toward your belly, bringing your elbows back close to your body.',
      'Squeeze your shoulder blades at the top, then lower slowly to straight arms.',
    ],
    tips: ["Don't use momentum from your torso.", 'Keep your neck in line with your back.'],
  }),
  seatedrow: (e) => ({
    steps: [
      e.load === 'machine' ? 'Sit with your chest against the pad and grab the handles.' : 'Sit at the cable row with feet on the platform and knees slightly bent.',
      'Back straight and chest up.',
      'Pull the handles toward your belly, bringing your elbows back.',
      'Squeeze your shoulder blades, then return forward slowly, straightening your arms.',
    ],
    tips: ['Your torso stays almost still.', 'Shoulders down, away from your ears.'],
  }),
  pullup: (e) => ({
    steps: [
      `Grab the bar ${e.opt.chin ? 'with palms facing you' : 'with palms facing away'}, slightly wider than your shoulders.`,
      'Start hanging with straight arms, shoulders active (not "hanging").',
      'Pull your chest toward the bar until your chin clears it.',
      'Lower slowly until your arms are straight.',
    ],
    tips: ["Don't swing your legs.", "If you can't do one yet, use a band or the assisted machine."],
  }),
  pulldown: () => ({
    steps: [
      'Sit at the lat pulldown with your thighs locked under the pads.',
      'Grab the bar slightly wider than your shoulders.',
      'Pull the bar to your upper chest, chest up and elbows down.',
      'Go back up slowly until your arms are straight.',
    ],
    tips: ["Don't pull behind your neck.", "Don't lean back too much."],
  }),
  straightarm: () => ({
    steps: [
      'Stand facing the high cable and grab the bar with almost straight arms.',
      'Lean your torso slightly forward.',
      'Bring the bar to your thighs in an arc, keeping your arms straight.',
      'Go back up slowly until you feel your lats stretch.',
    ],
    tips: ['Elbows stay almost locked.', 'Shoulders down throughout.'],
  }),
  pullover: (e) => ({
    steps: [
      `Lying on the bench, hold ${e.eq || 'a dumbbell'} with both hands over your chest.`,
      'Elbows slightly bent and fixed.',
      'Bring the weight behind your head in an arc until you feel your chest and lats stretch.',
      'Bring the weight back over your chest along the same arc.',
    ],
    tips: ["Brace your abs so your back doesn't arch.", 'Use a moderate load.'],
  }),
  curl: (e) => ({
    steps: [
      e.opt.preacher ? 'Sit at the preacher bench with the back of your arms on the pad.'
        : e.opt.incline ? 'Sit on an incline bench with your arms hanging down.'
        : e.opt.conc ? 'Sit and rest your elbow against the inside of your thigh.'
        : `Stand holding ${e.eq || 'the weight'} with arms straight at your sides.`,
      `${e.opt.hammer ? 'Neutral grip (palms facing each other)' : e.opt.reverse ? 'Overhand grip (palms down)' : 'Palms facing forward'}, elbows still and close to your body.`,
      'Bend your elbows and bring the weight toward your shoulders, squeezing your biceps.',
      'Lower slowly until your arms are straight.',
    ],
    tips: ["Don't swing with your back.", "Your elbows don't drift forward."],
  }),
  wristcurl: (e) => ({
    steps: [
      'Sit and rest your forearms on your thighs, wrists just past your knees.',
      `Hold ${e.eq || 'the weight'} with palms ${e.opt.reverse ? 'down' : 'up'}.`,
      'Let the weight drop by bending your wrists down.',
      'Curl your wrists up, using only your forearms.',
    ],
    tips: ['Small, controlled movement.', 'Your forearms stay on your thighs.'],
  }),
  ohext: (e) => ({
    steps: [
      `${e.opt.seated ? 'Seated' : 'Standing'}, hold ${e.eq || 'the weight'} overhead with straight arms.`,
      'Elbows tight and pointing forward.',
      'Bend your elbows and lower the weight behind your head.',
      'Straighten your arms, squeezing your triceps.',
    ],
    tips: ['Only your forearms move.', "Brace your abs so your back doesn't arch."],
  }),
  skull: (e) => ({
    steps: [
      `Lying on the bench, ${e.eq || 'the barbell'} over your chest with straight arms.`,
      'Tilt your arms slightly toward your head and keep them still.',
      'Bend your elbows and bring the weight toward your forehead.',
      'Straighten your arms, squeezing your triceps.',
    ],
    tips: ["Elbows don't flare out.", 'Lower slowly, with control.'],
  }),
  pushdown: (e) => ({
    steps: [
      `Stand facing the high cable and grab ${e.opt.rope ? 'the rope' : 'the bar'}.`,
      'Elbows tight to your sides, torso slightly forward.',
      'Push down until your arms are straight.',
      'Come back up slowly to about 90°, without moving your elbows.',
    ],
    tips: ['Only your forearms move.', "Don't use your body weight to push."],
  }),
  kickback: (e) => ({
    steps: [
      `Torso leaning forward, ${e.eq || 'the dumbbell'} in hand.`,
      'Bring your upper arm parallel to your torso, elbow bent at 90°.',
      'Straighten your elbow, moving the weight back.',
      'Return slowly to 90°, keeping your upper arm still.',
    ],
    tips: ['Your upper arm stays still, close to your body.', 'Use a light load and control the movement.'],
  }),
  latraise: (e) => ({
    steps: [
      `Stand with ${e.eq || 'the dumbbells'} at your sides, elbows slightly bent.`,
      'Raise your arms out to the sides up to shoulder height.',
      'Lead with your elbows, pinkies slightly higher than thumbs.',
      'Lower slowly.',
    ],
    tips: ["Don't go above your shoulders.", 'No swinging with your torso.'],
  }),
  frontraise: (e) => ({
    steps: [
      `Stand with ${e.eq || 'the weight'} in front of your thighs.`,
      'Raise your arms forward, almost straight, up to shoulder height.',
      'Pause for a moment and lower slowly.',
    ],
    tips: ['Torso still and abs braced.', "Don't go above eye level."],
  }),
  reardelt: (e) => ({
    steps: [
      e.load === 'machine' ? 'Sit at the machine facing the backrest and grab the handles.' : `Torso leaning forward, ${e.eq || 'the dumbbells'} under your chest.`,
      'Elbows slightly bent.',
      'Open your arms out to the sides and back, up to shoulder line.',
      'Return slowly.',
    ],
    tips: ['Think of moving your hands "wide", not back.', "Don't squeeze your shoulder blades too much: work the rear delts."],
  }),
  facepull: () => ({
    steps: [
      'Set the cable at face height and grab the rope with an overhand grip.',
      'Step back, arms straight in front of you.',
      'Pull the rope toward your face, opening your hands beside your ears, elbows high.',
      'Return slowly forward.',
    ],
    tips: ['Elbows stay at shoulder height.', 'Great for shoulder health: use a light load.'],
  }),
  uprightrow: (e) => ({
    steps: [
      `Stand with ${e.eq || 'the barbell'} in front of your thighs, shoulder-width grip.`,
      'Pull the weight up along your body, leading with your elbows.',
      'Stop when your elbows reach shoulder height.',
      'Lower slowly.',
    ],
    tips: ["Don't go above your shoulders if it feels uncomfortable.", 'Grip not too narrow.'],
  }),
  shrug: (e) => ({
    steps: [
      `Stand holding ${e.eq || 'the weight'} with straight arms.`,
      'Lift your shoulders toward your ears as high as possible.',
      'Hold the squeeze for a second.',
      'Lower slowly.',
    ],
    tips: ["Don't roll your shoulders: up and down.", 'Your arms stay straight.'],
  }),
  rotation: (e) => ({
    steps: [
      `Elbow bent at 90°${e.load === 'cable' || e.load === 'band' ? ', holding the cable or band' : ''}.`,
      'Keep your elbow still (by your side or at shoulder height).',
      'Rotate your forearm out (or in) using only your shoulder.',
      'Return slowly.',
    ],
    tips: ["Light load: it's a rotator cuff exercise.", 'Slow, controlled movement.'],
  }),
  fly: (e) => ({
    steps: [
      e.load === 'cable' ? 'Stand in the middle of the high cables, a handle in each hand, torso slightly forward.'
        : e.load === 'machine' ? 'Sit at the pec deck, back supported and arms open.'
        : 'Lying on the bench, dumbbells over your chest with palms facing each other.',
      'Elbows slightly bent and fixed.',
      'Open your arms in a wide arc until you feel your chest stretch.',
      'Bring your arms back together along the same arc, squeezing your chest.',
    ],
    tips: ["Don't go below shoulder line.", 'Think of "hugging" a tree.'],
  }),
  crunch: (e) => ({
    steps: e.opt.reverse ? [
      'Lie on your back, arms at your sides, knees bent and lifted.',
      'Bring your knees toward your chest, lifting your hips off the floor.',
      'Lower slowly without putting your feet down.',
    ] : e.load === 'cable' ? [
      'Kneel facing the high cable, holding the rope beside your head.',
      'Curl your torso, rounding your back and bringing your elbows toward your thighs.',
      'Squeeze your abs and come back up slowly.',
    ] : [
      'Lie on your back, knees bent and feet on the floor.',
      'Hands crossed on your chest or near your temples.',
      `Lift ${e.opt.situp ? 'your whole torso until you are sitting' : 'your head and shoulders off the floor, curling your back'}, squeezing your abs.`,
      'Lower slowly.',
    ],
    tips: ["Don't pull your neck with your hands.", 'Breathe out as you come up.'],
  }),
  legraise: (e) => ({
    steps: [
      e.opt.hanging ? 'Hang from the bar, arms straight and body still.' : 'Lie on your back, hands under your glutes or at your sides.',
      `Raise ${e.opt.knee ? 'your knees toward your chest' : 'your straight legs'}, squeezing your abs.`,
      'Go up to about 90° (or higher if you can without swinging).',
      'Lower slowly without swinging.',
    ],
    tips: ['Your lower back stays pressed to the floor (when lying).', 'No swinging.'],
  }),
  plank: () => ({
    steps: [
      'Put your forearms on the floor, elbows under your shoulders.',
      'Straighten your legs and rest on your toes.',
      'Body in a straight line: abs and glutes tight.',
      'Hold the position, breathing normally, for the set time.',
    ],
    tips: ["Don't raise or drop your hips.", 'Look at the floor.'],
  }),
  climber: () => ({
    steps: [
      'Start in a straight-arm plank.',
      'Bring one knee toward your chest.',
      'Quickly switch, bringing the other knee in, alternating.',
      'Keep the pace with your hips low.',
    ],
    tips: ['Shoulders over your hands.', 'Abs always tight.'],
  }),
  flutter: () => ({
    steps: [
      'Lie on your back, hands under your glutes.',
      'Lift your straight legs a few centimeters off the floor.',
      'Alternate small up-and-down leg movements.',
      'Keep your lower back on the floor.',
    ],
    tips: ['The lower your legs, the harder it is.', 'Breathe steadily.'],
  }),
  twistseat: (e) => ({
    steps: [
      `Sit on the floor with knees bent, holding ${e.eq || 'the medicine ball'} in front of your chest.`,
      'Lean back to about 45° with a straight back; to make it harder, lift your feet off the floor.',
      'Rotate your torso to one side, bringing the weight next to your hip.',
      'Come back to center and rotate to the other side: each side counts as one rep.',
    ],
    tips: ['Rotate your shoulders, not just your arms.', 'Keep your abs tight and your back neutral.'],
  }),
  woodchop: (e) => ({
    steps: [
      `Stand side-on ${e.load === 'cable' ? 'to the high cable' : 'holding the weight with both hands'}, feet shoulder-width apart.`,
      'Start with arms straight up, on the cable side.',
      'Bring your hands diagonally toward the opposite knee, rotating torso and hips.',
      'Return slowly to the top, controlling the rotation. Finish the reps and switch sides.',
    ],
    tips: ['The power comes from hips and torso, arms stay almost straight.', 'Pivot your back foot too.'],
  }),
  twist: (e) => ({
    steps: [
      `Seated or standing, hold ${e.eq || 'the weight'} in front of your chest.`,
      'Brace your abs and keep your back straight.',
      'Rotate your torso to one side, then the other, controlling the movement.',
    ],
    tips: ['Rotate your torso, not just your arms.', 'Controlled movement, no jerking.'],
  }),
  sidebend: (e) => ({
    steps: [
      `Stand with ${e.eq || 'a dumbbell'} in one hand at your side.`,
      'Bend sideways toward the weight.',
      'Come back upright, squeezing the obliques on the opposite side.',
      'Finish the reps and switch sides.',
    ],
    tips: ["Don't rotate your torso: only side bending.", 'Hips still.'],
  }),
  rollout: () => ({
    steps: [
      'Kneel and grab the wheel (or barbell) under your shoulders.',
      'Brace your abs and glutes.',
      'Roll the wheel forward, stretching your body as far as you can without arching your back.',
      'Come back using your abs.',
    ],
    tips: ['If your back arches, shorten the range.', 'Slow movement.'],
  }),
  kbswing: () => ({
    steps: [
      'Feet slightly wider than your shoulders, kettlebell on the floor in front of you.',
      'Grab it, push your hips back and swing it between your legs.',
      'Drive your hips forward explosively: the kettlebell rises to chest height.',
      'Let it swing back between your legs and repeat.',
    ],
    tips: ['The power comes from your hips, not your arms.', 'Neutral back at all times.'],
  }),
  clean: (e) => ({
    steps: [
      `Start as in a deadlift, ${e.eq || 'the barbell'} close to your shins.`,
      'Pull with your legs and, once past the knees, extend your hips explosively.',
      'Shrug and drive your elbows quickly forward under the bar.',
      'Catch the weight on your shoulders with a knee bend, then stand up.',
    ],
    tips: ['Keep the bar close to your body.', 'Learn the technique with light loads.'],
  }),
  snatch: (e) => ({
    steps: [
      `Wide grip on ${e.eq || 'the barbell'}, start as in a deadlift.`,
      'Pull with your legs and extend your hips explosively.',
      'Bring the bar overhead in one movement, dropping under it.',
      'Catch it with straight arms in a squat, then stand up.',
    ],
    tips: ['Technical lift: learn it with a coach.', 'Arms always straight on the catch.'],
  }),
  jump: () => ({
    steps: [
      'Stand with feet hip-width apart.',
      'Dip quickly, swinging your arms back.',
      'Jump explosively, driving with your legs and swinging your arms up.',
      'Land softly on the balls of your feet with bent knees and repeat.',
    ],
    tips: ['Land with knees in line with your feet.', 'Quality over quantity.'],
  }),
  jack: () => ({
    steps: [
      'Stand with feet together and arms at your sides.',
      'Jump, opening your legs and bringing your arms overhead.',
      'Jump again back to the start position.',
      'Keep a steady pace.',
    ],
    tips: ['Land on the balls of your feet.', 'Breathe steadily.'],
  }),
  run: (e) => ({
    steps: [
      e.opt.treadmill ? 'Step on the treadmill and start at a low speed.' : 'Start with a few minutes of easy warm-up.',
      'Torso upright, eyes forward, arms bent at about 90°.',
      'Land with your foot under your body, not too far in front.',
      'Build up the intensity and hold the pace for the set time.',
    ],
    tips: ['Short, quick steps are easier on your joints.', 'Breathe steadily.'],
  }),
  walk: (e) => ({
    steps: [
      `Grab ${e.eq || 'the weights'} and stand tall with a straight back.`,
      'Shoulders down and abs braced.',
      'Walk with short, controlled steps for the set distance or time.',
      'Put the weights down by bending your legs, not your back.',
    ],
    tips: ["Don't let the weights pull you sideways.", 'Firm grip.'],
  }),
  sled: () => ({
    steps: [
      'Grab the sled handles with straight arms.',
      'Lean your torso forward, keeping your back straight.',
      'Push with short, powerful steps, driving through your whole foot.',
      'Keep the same lean for the whole distance.',
    ],
    tips: ['Knees forward, drive from the legs.', 'Abs tight.'],
  }),
  bike: () => ({
    steps: [
      'Adjust the seat: with the pedal at the bottom, your knee stays slightly bent.',
      'Hands on the handlebars, back straight and shoulders relaxed.',
      'Pedal smoothly, pushing and pulling the pedal.',
      'Set resistance and cadence to suit your workout.',
    ],
    tips: ["Don't rock your hips.", 'Start easy to warm up.'],
  }),
  rowmachine: () => ({
    steps: [
      'Sit at the rower, feet strapped in and handle in your hands with straight arms.',
      'Push with your legs first, then lean your torso slightly back.',
      'Pull the handle to your belly with your arms.',
      'Return forward in reverse order: arms, torso, legs.',
    ],
    tips: ['About 60% of the power comes from your legs.', 'Back straight, never rounded.'],
  }),
  rope: () => ({
    steps: [
      'Hold the rope, elbows close to your sides.',
      'Turn the rope with your wrists, not your arms.',
      'Jump just a few centimeters, landing on the balls of your feet.',
      'Keep a steady rhythm.',
    ],
    tips: ['Low, light jumps.', 'Soft knees.'],
  }),
  hipflex: () => ({
    steps: [
      'Stand tall, holding a support if needed.',
      'Raise one knee toward your chest up to hip height.',
      'Lower slowly and switch legs.',
    ],
    tips: ['Torso still.', 'Controlled movement.'],
  }),
  abduction: (e) => ({
    steps: [
      e.load === 'machine' ? 'Sit at the machine with the pads on the outside of your knees.' : 'Stand side-on to the support, ankle strap or band on the outer leg.',
      'Torso still and abs braced.',
      'Move your leg (or legs) outward.',
      'Return slowly.',
    ],
    tips: ["Don't lean your torso.", 'Control the return.'],
  }),
  adduction: (e) => ({
    steps: [
      e.load === 'machine' ? 'Sit at the machine with the pads on the inside of your knees.' : 'Stand side-on to the support, ankle strap on the inner leg.',
      'Torso still and abs braced.',
      'Bring your leg (or legs) inward.',
      'Return slowly.',
    ],
    tips: ['Controlled movement.', "Don't use momentum."],
  }),
  mbthrow: (e) => ({
    steps: e.opt.slam ? [
      'Stand with the medicine ball overhead, arms straight.',
      'Slam it hard to the floor in front of you, bending your torso and legs.',
      'Pick it up and repeat.',
    ] : [
      'Stand facing a wall or a partner, medicine ball at your chest.',
      'Load the movement with your legs and torso.',
      'Throw the ball explosively.',
      'Catch it on the rebound and repeat.',
    ],
    tips: ['Use your whole body, not just your arms.', 'Pick a ball made for throwing.'],
  }),
  roll: (e) => ({
    steps: [
      `Place the foam roller under the area to work on (${MUSCLE[e.muscle] || 'the muscle'}).`,
      'Support your weight with your hands or forearms to adjust the pressure.',
      'Slowly roll your body back and forth for 30-60 seconds.',
      'On the tightest spots, pause for a few seconds and breathe.',
    ],
    tips: ['Firm but not painful pressure.', 'Avoid bones and joints.'],
  }),
  neck: () => ({
    steps: [
      'Sit or stand with a straight back.',
      'Slowly move your head in the direction shown, without forcing.',
      'Come back to center and repeat.',
    ],
    tips: ['Slow, controlled movements.', 'Stop if you feel pain.'],
  }),
  stretch: (e) => ({
    steps: [
      `Get into the position shown and slowly stretch ${{
        Quadricipiti: 'the front of your thigh', Femorali: 'the back of your thigh', Polpacci: 'your calf',
        Petto: 'your chest', Spalle: 'your shoulder', Tricipiti: 'your triceps', Dorso: 'your back', Lombari: 'your lower back',
        Glutei: 'your glute', Abduttori: 'the outside of your hip', Adduttori: 'your inner thigh', Addome: 'your abs',
        Collo: 'your neck', Trapezi: 'your traps', Avambracci: 'your forearm', Bicipiti: 'your biceps',
      }[e.muscle] || 'the muscle'}.`,
      'Stop when you feel moderate tension, never pain.',
      'Hold for 20-30 seconds, breathing slowly and relaxing.',
      'If the exercise is one-sided, repeat on the other side.',
    ],
    tips: ['No bouncing: a static, gradual stretch.', 'Ideal at the end of a workout.'],
  }),
};

export const MODS = [
  [/\b(one[- ]arm|single[- ]arm|un braccio)\b/i, 'Do one arm at a time, then switch sides.'],
  [/\b(one[- ]leg|single[- ]leg|una gamba)\b/i, 'Do it on one leg, then switch sides.'],
  [/alternat/i, 'Alternate right and left on every rep.'],
  [/\b(close[- ]grip|narrow|stretta)\b/i, 'Close grip: works the triceps and inner part more.'],
  [/\b(wide[- ]grip|wide|larga)\b/i, 'Wide grip.'],
  [/\b(reverse[- ]grip|underhand|supinat|supina)\b/i, 'Reverse grip (palms facing you).'],
  [/\b(neutral[- ]grip|hammer|martello)\b/i, 'Neutral grip (palms facing each other).'],
  [/smith|multipower/i, 'On the Smith machine: the bar runs on fixed rails.'],
  [/\bband|elastic/i, 'With a band: resistance increases as you stretch it.'],
  [/\bpause/i, 'Pause for 1-2 seconds at the hardest point.'],
  [/deficit/i, 'Deficit: start from a raised surface for a longer range.'],
  [/\bsumo\b/i, 'Wide stance and toes pointing out (sumo style).'],
  [/\bkneeling\b/i, 'From a kneeling position.'],
  [/\bisometric|\bhold\b/i, 'Hold the position for the set time.'],
  [/\bpartial|\bquarter\b/i, 'Do only part of the range of motion.'],
  [/\bstability ball|exercise ball|fitball/i, 'On a stability ball: needs more balance and control.'],
  [/\bbosu/i, 'On a BOSU: improves balance and stability.'],
];
