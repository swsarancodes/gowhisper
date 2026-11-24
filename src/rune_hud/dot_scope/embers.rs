//! Embers: GoSpell's GoML look for the recording HUD, the default
//! [`super::Look`]. Embers ride a turning double helix that swells with the
//! voice, the loudest moment travelling out from the middle. While GoSpell
//! transcribes and processes they fly together into GoML's G-arrow. Done
//! collapses them into a white-hot flash, a ripple leaves the middle, and
//! the GoML mark pops in; a failure turns them coral as the HUD fades.
//!
//! [`Embers`] steps with [`super::Scope`] at its fixed 240 Hz. Each frame
//! yields one [`Sprite`] per ember, packed for `rune_hud.wgsl`
//! ([`Embers::words`]), and the finale's terms ([`Finale`]).

use std::f32::consts::{PI, TAU};

use super::Stage;

/// How many embers there are: two strands of half as many.
pub const COUNT: usize = 160;
/// The mark's diameter, as a share of the plate's height.
pub const MARK_SHARE: f32 = 0.85;
/// How long done shows before the HUD collapses, s: the mark has popped in
/// and the ripple is most of the way out.
pub const FINALE: f32 = 0.9;
/// The plate height the embers' sizes are drawn for, pt.
const DESIGN_HEIGHT: f32 = 26.0;
/// How long the voice takes to travel from the middle to the ends, s.
const SPREAD: f32 = 0.45;
/// How much voice history is kept, s.
const KEPT: f32 = 0.5;
/// The helix's turn, Hz.
const SPIN_HZ: f32 = 0.26;
/// Helix turns across the plate.
const TURNS: f32 = 1.5;
/// How fast the embers gather into the G, a time constant, s.
const GATHER: f32 = 0.42;
/// How far apart the embers leave for the G, as a share of the gathering.
const STAGGER: f32 = 0.45;
/// How long done's collapse into the middle takes, s.
const COLLAPSE: f32 = 0.32;
/// When the mark pops in and the ripple leaves, s into done.
const POP_AT: f32 = 0.28;
/// How long the mark's pop takes, s.
const POP: f32 = 0.4;
/// How long the ripple lasts, s.
const RIPPLE: f32 = 0.9;

/// GoML's G-arrow in its 36-unit mark (`site/public/favicon.svg`), y down:
/// the ring's middle, its middle radius, and half its thickness.
pub const RING_CENTER: [f32; 2] = [17.15, 17.976];
pub const RING_RADIUS: f32 = 9.4;
pub const RING_HALF: f32 = 2.2;
/// The arrow, its stem, and the ring's foot, as one polygon. The ring is
/// the left half of an annulus: x at most `RING_CENTER[0]`, its lower end a
/// little further. The foot starts a little inside the ring, so the two
/// never meet on an edge.
pub const ARROW: [[f32; 2]; 12] = [
    [16.6, 25.282],
    [18.2489, 25.2842],
    [23.2149, 20.316],
    [23.4288, 20.1064],
    [14.4135, 20.1064],
    [14.4135, 15.8149],
    [23.4288, 15.8149],
    [18.8382, 11.2243],
    [21.8724, 8.19014],
    [31.6386, 17.9585],
    [20.0235, 29.5758],
    [16.6, 29.5758],
];

/// Whether `p`, in the mark's 36 units, is inside the G-arrow.
pub fn in_mark(p: [f32; 2]) -> bool {
    let [cx, cy] = RING_CENTER;
    let r = ((p[0] - cx).powi(2) + (p[1] - cy).powi(2)).sqrt();
    // The lower end reaches under the arrow's foot, as `rune_hud.wgsl` draws it.
    let end = if p[1] > cy { cx + 0.75 } else { cx };
    let ring = p[0] <= end && (r - RING_RADIUS).abs() <= RING_HALF;
    // Even-odd ray cast.
    let mut inside = false;
    let mut j = ARROW.len() - 1;
    for i in 0..ARROW.len() {
        let (a, b) = (ARROW[i], ARROW[j]);
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
        {
            inside = !inside;
        }
        j = i;
    }
    ring || inside
}

/// `rune_hud.wgsl`'s `embers` uniform: 1 for the Embers look, how many
/// embers the dot buffer holds, then the mark's pop scale and opacity; all
/// 0 for the classic look.
pub fn look_terms(embers: bool, count: usize, finale: Finale) -> [f32; 4] {
    if embers {
        [1.0, count.min(COUNT) as f32, finale.pop, finale.mark]
    } else {
        [0.0; 4]
    }
}

/// `rune_hud.wgsl`'s `finale` uniform for a plate `height` pt tall: the
/// flash, the ripple's age, the mark's diameter, and the embers' size scale.
pub fn finale_terms(finale: Finale, height: f32) -> [f32; 4] {
    [
        finale.flash,
        finale.ripple,
        height * MARK_SHARE,
        height / DESIGN_HEIGHT,
    ]
}

/// One ember as drawn, pt from the plate's middle, y down.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Sprite {
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    /// 0 to 2: more than 1 blooms.
    pub brightness: f32,
    /// 0 deep orange to 1 white-hot.
    pub warmth: f32,
}

/// Done's terms for the shader.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Finale {
    /// The white-hot flash where the embers met, 0 to 1.
    pub flash: f32,
    /// Seconds since the ripple left the middle, below 0 before it does.
    pub ripple: f32,
    /// The mark's scale as it pops, past 1 as it overshoots.
    pub pop: f32,
    /// The mark's opacity.
    pub mark: f32,
}

#[derive(Clone, Copy)]
struct Seed {
    /// Where along the helix, 0 to 1.
    u: f32,
    strand: u8,
    /// When it leaves for the G, as a share of the gathering.
    delay: f32,
    /// Its place in the G, pt per pt of mark diameter from the mark's middle.
    target: [f32; 2],
    twinkle: f32,
    /// How far off its strand it drifts, -0.5 to 0.5: embers, not a rope.
    scatter: f32,
    /// How late it joins done's collapse.
    late: f32,
}

/// A small fixed generator, so every HUD draws the same embers.
struct Lcg(u32);

impl Lcg {
    fn next(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (self.0 >> 8) as f32 / (1u32 << 24) as f32
    }
}

fn seeds() -> Vec<Seed> {
    let mut random = Lcg(0x60_4d_4c);
    // The G's points on the coarsest even grid that has one for every
    // ember, so the gathered G reads as evenly spaced sparks, then shuffled
    // so each ember flies to a place of its own.
    let grid = |step: f32| {
        let cells = (36.0 / step) as usize;
        let mut points = Vec::new();
        for j in 0..cells {
            for i in 0..cells {
                let p = [(i as f32 + 0.5) * step, (j as f32 + 0.5) * step];
                if in_mark(p) {
                    points.push([p[0] / 36.0 - 0.5, p[1] / 36.0 - 0.5]);
                }
            }
        }
        points
    };
    let mut step = 2.0;
    let mut points = grid(step);
    while points.len() < COUNT && step > 0.5 {
        step -= 0.02;
        points = grid(step);
    }
    // Every ember gets a place; spare places are dropped evenly.
    let mut points: Vec<[f32; 2]> = (0..COUNT)
        .map(|n| points[n * points.len() / COUNT])
        .collect();
    for i in (1..points.len()).rev() {
        let j = (random.next() * (i + 1) as f32) as usize % (i + 1);
        points.swap(i, j);
    }
    let half = COUNT / 2;
    (0..COUNT)
        .map(|n| {
            let jitter = [random.next() - 0.5, random.next() - 0.5];
            let point = points[n];
            Seed {
                u: (n % half) as f32 / half as f32 + random.next() * 0.004,
                strand: (n / half) as u8,
                delay: random.next() * STAGGER,
                target: [point[0] + jitter[0] / 144.0, point[1] + jitter[1] / 144.0],
                scatter: random.next() - 0.5,
                twinkle: random.next() * TAU,
                late: random.next() * 0.12,
            }
        })
        .collect()
}

fn smoothstep(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Overshoots a little, then settles at 1.
fn back_out(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    let (c1, c3) = (1.70158, 2.70158);
    1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
}

/// The Embers simulation.
pub struct Embers {
    seeds: Vec<Seed>,
    /// The voice's 0–1 level, newest last, one per step.
    history: Vec<f32>,
    head: usize,
    level: f32,
    spin: f32,
    time: f32,
    stage: Stage,
    /// Seconds into the stage.
    elapsed: f32,
    /// How far the embers have gathered into the G, 0 to 1.
    gather: f32,
    /// How far done's collapse has gone, 0 to 1.
    collapse: f32,
    reduce_motion: bool,
}

impl Embers {
    pub fn new() -> Self {
        let kept = (KEPT / super::scope::STEP) as usize;
        Self {
            seeds: seeds(),
            history: vec![0.0; kept],
            head: 0,
            level: 0.0,
            spin: 0.0,
            time: 0.0,
            stage: Stage::Recording,
            elapsed: 0.0,
            gather: 0.0,
            collapse: 0.0,
            reduce_motion: false,
        }
    }

    /// One fixed step of `h` seconds at `stage`, `elapsed` into it, with the
    /// voice at `level` (0 to 1, 0 when not recording).
    pub fn step(&mut self, h: f32, stage: Stage, elapsed: f32, level: f32, reduce_motion: bool) {
        self.stage = stage;
        self.elapsed = elapsed;
        self.reduce_motion = reduce_motion;
        let level = if level.is_finite() {
            level.clamp(0.0, 1.0)
        } else {
            0.0
        };
        self.level = level;
        self.history[self.head] = level;
        self.head = (self.head + 1) % self.history.len();
        self.time += h;
        if !reduce_motion {
            self.spin = (self.spin + h * TAU * SPIN_HZ) % TAU;
        }
        // Working gathers the embers into the G; done keeps them there while
        // it collapses them; a new recording or a failure lets them go.
        let gathered =
            matches!(stage, Stage::Processing) || (stage == Stage::Done && self.gather > 0.05);
        let target = if gathered { 1.0 } else { 0.0 };
        if reduce_motion {
            self.gather = target;
        } else {
            self.gather += (target - self.gather) * (1.0 - (-h / GATHER).exp());
        }
        self.collapse = match stage {
            Stage::Done if reduce_motion => 1.0,
            Stage::Done => (elapsed / COLLAPSE).clamp(0.0, 1.0),
            _ => self.collapse * (-h / 0.1).exp(),
        };
    }

    /// The voice's level `delay` seconds ago.
    fn past(&self, delay: f32) -> f32 {
        let len = self.history.len();
        let back = ((delay / super::scope::STEP) as usize).min(len - 1);
        self.history[(self.head + 2 * len - 1 - back) % len]
    }

    /// Each ember on a plate `width` × `height` pt.
    pub fn sprites(&self, width: f32, height: f32) -> Vec<Sprite> {
        let size = height / DESIGN_HEIGHT;
        let half = (height / 2.0 - 2.0).max(4.0);
        let pad = height * 0.5;
        let span = (width - 2.0 * pad).max(0.0);
        let mark = height * MARK_SHARE;
        let fade = if self.stage == Stage::Done && !self.reduce_motion {
            1.0 - smoothstep(0.3, 0.5, self.elapsed)
        } else if self.stage == Stage::Done {
            0.0
        } else {
            1.0
        };
        let twinkles = !self.reduce_motion;
        self.seeds
            .iter()
            .map(|seed| {
                let envelope = (PI * seed.u).sin().max(0.0).powf(1.2);
                let voice = self.past((seed.u - 0.5).abs() * 2.0 * SPREAD);
                let amplitude = envelope * (0.12 * half + 0.72 * half * voice);
                let strand = f32::from(seed.strand);
                let theta = seed.u * PI * 2.0 * TURNS + self.spin + strand * PI;
                let drift = seed.scatter * (0.9 + 0.5 * voice) * size;
                let (hx, hy) = (
                    -span / 2.0 + seed.u * span,
                    amplitude * theta.sin() + drift * envelope,
                );
                let near = (theta.cos() + 1.0) / 2.0;

                let m = (self.gather * (1.0 + STAGGER) - seed.delay).clamp(0.0, 1.0);
                let m = m * m * (3.0 - 2.0 * m);
                let shimmer = if twinkles {
                    (self.time * 3.0 + seed.twinkle).sin() * 0.06 * size
                } else {
                    0.0
                };
                let (fx, fy) = (seed.target[0] * mark, seed.target[1] * mark + shimmer);
                let side = if seed.strand == 0 { -1.0 } else { 1.0 };
                let arc = (m * PI).sin() * 0.38 * half * side;
                let mut x = hx + (fx - hx) * m;
                let mut y = hy + (fy - hy) * m + arc;

                let k = ((self.collapse - seed.late) / (1.0 - seed.late)).clamp(0.0, 1.0);
                let k = k * k * k;
                x *= 1.0 - k;
                y *= 1.0 - k;

                let radius = ((0.2 + 0.34 * near + 0.16 * self.level) * (1.0 - m) + 0.4 * m)
                    * (1.0 - 0.5 * k)
                    * size;
                let glint = if twinkles {
                    0.75 + 0.25 * (self.time * 5.0 + seed.twinkle).sin()
                } else {
                    0.9
                };
                let brightness = (((0.22 + 0.68 * near) * (1.0 - m) + glint * m) + 0.6 * k) * fade;
                Sprite {
                    x,
                    y,
                    radius,
                    brightness: brightness.clamp(0.0, 2.0),
                    warmth: (0.75 * near * (1.0 - m) + 0.8 * m + k).clamp(0.0, 1.0),
                }
            })
            .collect()
    }

    /// Done's flash, ripple and mark; all at rest before done.
    pub fn finale(&self) -> Finale {
        if self.stage != Stage::Done {
            return Finale {
                ripple: -1.0,
                ..Finale::default()
            };
        }
        if self.reduce_motion {
            return Finale {
                flash: 0.0,
                ripple: -1.0,
                pop: 1.0,
                mark: 1.0,
            };
        }
        let e = self.elapsed;
        let since = e - POP_AT;
        Finale {
            flash: smoothstep(0.15, 0.3, e) * (1.0 - smoothstep(0.3, 0.75, e)),
            ripple: if since >= 0.0 && since <= RIPPLE {
                since
            } else {
                -1.0
            },
            pop: if since > 0.0 {
                back_out(since / POP)
            } else {
                0.0
            },
            mark: if since > 0.0 { 1.0 } else { 0.0 },
        }
    }

    /// The sprites packed two words to an ember for `rune_hud.wgsl`: x and y
    /// as (pt + 512) × 64, then radius and warmth as bytes (radius over
    /// 4 pt) beside brightness over 2.
    pub fn words(&self, width: f32, height: f32) -> Vec<[u16; 2]> {
        self.sprites(width, height)
            .into_iter()
            .flat_map(|s| {
                let position = |v: f32| ((v + 512.0) * 64.0).round().clamp(0.0, 65535.0) as u16;
                let byte = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u16;
                let unit = |v: f32| (v.clamp(0.0, 1.0) * 65535.0).round() as u16;
                [
                    [position(s.x), position(s.y)],
                    [
                        (byte(s.radius / 4.0) << 8) | byte(s.warmth),
                        unit(s.brightness / 2.0),
                    ],
                ]
            })
            .collect()
    }
}

impl Default for Embers {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(embers: &mut Embers, stage: Stage, seconds: f32, level: f32) {
        let h = super::super::scope::STEP;
        let steps = (seconds / h).round() as usize;
        let start = embers.elapsed * f32::from(u8::from(embers.stage == stage));
        for n in 0..steps {
            embers.step(h, stage, start + (n + 1) as f32 * h, level, false);
        }
    }

    fn spread(sprites: &[Sprite]) -> f32 {
        sprites.iter().map(|s| s.y.abs()).fold(0.0, f32::max)
    }

    #[test]
    fn the_mark_has_room_for_every_ember() {
        let inside = (0..36 * 36)
            .filter(|n| in_mark([(n % 36) as f32 + 0.5, (n / 36) as f32 + 0.5]))
            .count();
        assert!(inside >= COUNT, "the G holds {inside} points");
        // The ring's left edge, the arrow's tip, and the hole stay apart.
        assert!(in_mark([7.0, 18.0]));
        assert!(in_mark([30.0, 18.0]));
        assert!(!in_mark([12.0, 18.0]));
        assert!(!in_mark([2.0, 18.0]));
    }

    #[test]
    fn the_voice_swells_the_helix() {
        let mut quiet = Embers::new();
        run(&mut quiet, Stage::Recording, 0.6, 0.0);
        let mut loud = Embers::new();
        run(&mut loud, Stage::Recording, 0.6, 1.0);
        let (quiet, loud) = (
            spread(&quiet.sprites(112.0, 26.0)),
            spread(&loud.sprites(112.0, 26.0)),
        );
        assert!(loud > quiet * 3.0, "quiet {quiet} loud {loud}");
        assert!(loud <= 13.0, "the helix stays on the plate: {loud}");
    }

    #[test]
    fn working_gathers_the_embers_into_the_g() {
        let mut embers = Embers::new();
        run(&mut embers, Stage::Recording, 0.5, 0.6);
        run(&mut embers, Stage::Processing, 2.5, 0.0);
        let mark = 26.0 * MARK_SHARE;
        for sprite in embers.sprites(76.0, 26.0) {
            let p = [sprite.x / mark * 36.0 + 18.0, sprite.y / mark * 36.0 + 18.0];
            assert!(
                (0.0..36.0).contains(&p[0]) && (0.0..36.0).contains(&p[1]),
                "{p:?} sits in the mark"
            );
        }
        assert_eq!(embers.finale().mark, 0.0, "the mark waits for done");
    }

    #[test]
    fn done_collapses_then_pops_the_mark() {
        let mut embers = Embers::new();
        run(&mut embers, Stage::Processing, 1.5, 0.0);
        run(&mut embers, Stage::Done, COLLAPSE, 0.0);
        assert!(
            embers
                .sprites(76.0, 26.0)
                .iter()
                .all(|s| s.x.abs() < 0.01 && s.y.abs() < 0.01),
            "every ember has reached the middle"
        );
        run(&mut embers, Stage::Done, FINALE - COLLAPSE, 0.0);
        let finale = embers.finale();
        assert_eq!(finale.mark, 1.0);
        assert!((finale.pop - 1.0).abs() < 0.02, "settled: {}", finale.pop);
        assert!(finale.ripple > 0.0 && finale.flash < 0.01);
        assert!(
            embers
                .sprites(76.0, 26.0)
                .iter()
                .all(|s| s.brightness == 0.0)
        );
    }

    #[test]
    fn reduce_motion_shows_the_mark_at_once() {
        let mut embers = Embers::new();
        embers.step(0.01, Stage::Done, 0.01, 0.0, true);
        let finale = embers.finale();
        assert_eq!((finale.pop, finale.mark, finale.ripple), (1.0, 1.0, -1.0));
    }

    #[test]
    fn words_round_trip_position_and_light() {
        let mut embers = Embers::new();
        run(&mut embers, Stage::Recording, 0.3, 0.5);
        let sprites = embers.sprites(112.0, 26.0);
        let words = embers.words(112.0, 26.0);
        assert_eq!(words.len(), 2 * COUNT);
        for (sprite, pair) in sprites.iter().zip(words.chunks(2)) {
            let x = f32::from(pair[0][0]) / 64.0 - 512.0;
            let y = f32::from(pair[0][1]) / 64.0 - 512.0;
            assert!((x - sprite.x).abs() < 0.01 && (y - sprite.y).abs() < 0.01);
            let brightness = f32::from(pair[1][1]) / 65535.0 * 2.0;
            assert!((brightness - sprite.brightness).abs() < 1e-3);
        }
    }
}
