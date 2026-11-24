//! The GoSpell mark in onboarding, drawn from GoML's G-arrow
//! (`rune_hud::dot_scope::embers`, the same geometry the HUD draws): the
//! thin progress ring that traces the GoML disc while a download runs and
//! holds the G-arrow once it is done, and the full-colour GoML logo that
//! `"GoSpell is ready"` builds.

use rune::{Color, El, LineCap, Shape, canvas};

use super::super::controls::Paint;
use crate::rune_hud::dot_scope::embers::{ARROW, RING_CENTER, RING_HALF, RING_RADIUS};

type Point = [f32; 2];

/// GoML's orange (`site/public/favicon.svg`).
fn goml_orange() -> Color {
    rune::color::hex("#ff8600").unwrap_or(Color::WHITE)
}
/// Segments in a full circle: smooth at the hero size, cheap at 14 pt.
const ROUND: usize = 72;
/// The G-arrow's share of the progress ring's diameter once it is done.
const GLYPH_IN_RING: f32 = 0.66;

/// The ring's stroke: thin in the menu bar, a little heavier as a hero.
fn stroke_width(size: f32) -> f32 {
    let t = ((size - 16.0) / 120.0).clamp(0.0, 1.0);
    1.2 + (2.2 - 1.2) * t
}

/// A circle of `radius` around `centre`, from 12 o'clock clockwise, closed.
fn circle(centre: Point, radius: f32) -> Vec<Point> {
    (0..=ROUND)
        .map(|i| {
            let a = (i as f32 / ROUND as f32) * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
            [centre[0] + radius * a.cos(), centre[1] + radius * a.sin()]
        })
        .collect()
}

/// The G's ring, the left half of an annulus, as one polygon in the mark's
/// 36 units: the outer arc top to bottom through the left, then the inner
/// arc back up.
fn ring_polygon() -> Vec<Point> {
    let [cx, cy] = RING_CENTER;
    let (outer, inner) = (RING_RADIUS + RING_HALF, RING_RADIUS - RING_HALF);
    let steps = ROUND / 2;
    let arc = |radius: f32, i: usize| {
        let a = -std::f32::consts::FRAC_PI_2 - std::f32::consts::PI * i as f32 / steps as f32;
        [cx + radius * a.cos(), cy + radius * a.sin()]
    };
    let mut points: Vec<Point> = (0..=steps).map(|i| arc(outer, i)).collect();
    points.extend((0..=steps).rev().map(|i| arc(inner, i)));
    points
}

/// Mark units (0–36, middle at 18) to points: `diameter` across, centred
/// on `centre`, `scale`d about the middle and moved `shift` points right.
fn place(points: &[Point], centre: Point, diameter: f32, scale: f32, shift: f32) -> Vec<Point> {
    let unit = diameter / 36.0 * scale;
    points
        .iter()
        .map(|[x, y]| {
            [
                centre[0] + (x - 18.0) * unit + shift,
                centre[1] + (y - 18.0) * unit,
            ]
        })
        .collect()
}

/// The G-arrow's two pieces, the ring and the arrow with its stem.
fn glyph(
    shape: Shape,
    centre: Point,
    diameter: f32,
    scale: f32,
    shift: f32,
    color: Color,
) -> Shape {
    shape
        .fill(place(&ring_polygon(), centre, diameter, scale, 0.0), color)
        .fill(place(&ARROW, centre, diameter, scale, shift), color)
}

fn sweep_poly(poly: &[Point], fraction: f32) -> (Vec<Point>, Option<Point>) {
    let f = fraction.clamp(0.0, 1.0);
    if f <= 0.0 || poly.len() < 2 {
        return (Vec::new(), None);
    }
    if f >= 1.0 {
        let mut closed = poly.to_vec();
        closed.pop();
        return (closed, None);
    }
    let segs: Vec<f32> = poly
        .windows(2)
        .map(|w| (w[1][0] - w[0][0]).hypot(w[1][1] - w[0][1]))
        .collect();
    let total: f32 = segs.iter().sum();
    let target = total * f;
    let mut acc = 0.0;
    let mut out = vec![poly[0]];
    for (i, &len) in segs.iter().enumerate() {
        if acc + len >= target {
            let u = if len > 1e-5 {
                ((target - acc) / len).clamp(0.0, 1.0)
            } else {
                0.0
            };
            let a = poly[i];
            let b = poly[i + 1];
            let tip = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
            out.push(tip);
            return (out, Some(tip));
        }
        acc += len;
        out.push(poly[i + 1]);
    }
    let last = *out.last().unwrap_or(&poly[0]);
    (out, Some(last))
}

fn disc_points(centre: Point, radius: f32) -> Vec<Point> {
    (0..16)
        .map(|i| {
            let a = i as f32 / 16.0 * std::f32::consts::TAU;
            [centre[0] + radius * a.cos(), centre[1] + radius * a.sin()]
        })
        .collect()
}

pub(crate) fn gospell_meter(p: Paint, key: &str, size: f32, progress: f32, closed: f32) -> El {
    canvas(meter_shape(p, size, progress, closed))
        .key(key)
        .size(size, size)
        .label(format!("{}%", (progress.clamp(0.0, 1.0) * 100.0).round()))
}

/// When each of the logo's pieces lands on `"GoSpell is ready"` (the disc,
/// the ring, then the arrow), in seconds after the page appears; each sounds
/// one rising note.
pub(crate) const BUILD_AT: [f64; 3] = [0.0, 0.15, 0.30];
/// When the last piece has settled.
pub(crate) const BUILD_SECS: f64 = 0.30 + SETTLE.0 * 1.5;
/// Each piece's spring: duration and bounce.
const SETTLE: (f64, f64) = (0.36, 0.12);
/// How long a piece takes to appear as it starts to settle.
const APPEAR: f64 = 0.08;
/// How far beyond its size the disc and the ring start, as a fraction.
const GROW: [f32; 2] = [0.12, 0.22];
/// How far left of its place the arrow starts, as a fraction of the logo.
const SLIDE: f32 = 0.35;

/// Progress of a critically-ish damped spring from 0 to 1 at `t` seconds.
fn settle(t: f64) -> f32 {
    if t <= 0.0 {
        return 0.0;
    }
    let (duration, bounce) = SETTLE;
    let omega = std::f64::consts::TAU / duration;
    let zeta = 1.0 - bounce;
    let damped = omega * (1.0 - zeta * zeta).sqrt();
    let decay = (-zeta * omega * t).exp();
    (1.0 - decay * ((damped * t).cos() + zeta * omega / damped * (damped * t).sin())) as f32
}

/// The GoML logo for `"GoSpell is ready"`, built `age` seconds after the page
/// appears: the orange disc, then the G's white ring, then its arrow sliding
/// in from the left, each springing into place. `handed`: the disc arrives
/// from the download pill already drawn. Reduced Motion shows it built.
pub(crate) fn gospell_logo(
    p: Paint,
    key: &str,
    size: f32,
    age: f64,
    reduced: bool,
    handed: bool,
) -> El {
    let _ = p;
    let pad = 12.0;
    let total = size + 2.0 * pad;
    let centre = [total * 0.5, total * 0.5];
    // (settle progress, opacity) for piece `i`.
    let stage = |i: usize| -> (f32, f32) {
        if reduced || (i == 0 && handed) {
            return (1.0, 1.0);
        }
        let t = age - BUILD_AT[i];
        (settle(t), (t / APPEAR).clamp(0.0, 1.0) as f32)
    };

    let mut shape = Shape::new();
    let (s, shown) = stage(0);
    if shown > 0.0 {
        let radius = size * 0.5 * (1.0 + GROW[0] * (1.0 - s));
        shape = shape.fill(circle(centre, radius), goml_orange().alpha(shown));
    }
    let (s, shown) = stage(1);
    if shown > 0.0 {
        let scale = 1.0 + GROW[1] * (1.0 - s);
        shape = shape.fill(
            place(&ring_polygon(), centre, size, scale, 0.0),
            Color::WHITE.alpha(shown),
        );
    }
    let (s, shown) = stage(2);
    if shown > 0.0 {
        let shift = -SLIDE * size * (1.0 - s);
        shape = shape.fill(
            place(&ARROW, centre, size, 1.0, shift),
            Color::WHITE.alpha(shown),
        );
    }
    canvas(shape).key(key).size(total, total).label("GoSpell")
}

fn meter_shape(p: Paint, size: f32, progress: f32, closed: f32) -> Shape {
    let w = stroke_width(size);
    let centre = [size * 0.5, size * 0.5];
    let poly = circle(centre, size * 0.5 - w * 0.5);
    let mut ring = poly.clone();
    ring.pop();

    let progress = progress.clamp(0.0, 1.0);
    let closed = closed.clamp(0.0, 1.0);
    let track = p.k.c.bg_deep.mix(p.k.c.border_base, 0.9);
    let lit = p.text();

    let mut shape = Shape::new();
    if progress < 1.0 {
        shape = shape.stroke_with(ring.clone(), true, w, LineCap::Round, track);
    }
    // The G-arrow fades in as the finished ring closes, never in one frame.
    if progress >= 1.0 && closed > 0.0 {
        shape = glyph(
            shape,
            centre,
            size * GLYPH_IN_RING,
            1.0,
            0.0,
            lit.alpha(closed),
        );
    }
    if progress >= 1.0 && closed >= 1.0 {
        shape = shape.stroke_with(ring, true, w, LineCap::Round, lit);
    } else if progress > 0.002 {
        let (arc, tip) = sweep_poly(&poly, progress);
        let closed_loop = progress >= 1.0;
        shape = shape.stroke_with(arc, closed_loop, w, LineCap::Round, lit);
        if let Some(pt) = tip.filter(|_| size >= 36.0) {
            shape = shape.fill(disc_points(pt, w * 1.15), lit);
        }
    }
    shape
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stroke_stays_thin_from_menu_bar_to_hero() {
        assert!(stroke_width(14.0) >= 1.1 && stroke_width(14.0) <= 1.6);
        assert!(stroke_width(136.0) <= 3.0);
    }

    #[test]
    fn the_logo_builds_in_three_beats_and_settles() {
        assert_eq!(settle(-0.1), 0.0);
        let peak = (1..200)
            .map(|i| settle(i as f64 / 200.0))
            .fold(0.0, f32::max);
        assert!(
            peak > 1.0 && peak < 1.05,
            "a soft settle, not a bounce: {peak}"
        );
        assert!((settle(BUILD_SECS - BUILD_AT[2]) - 1.0).abs() < 0.01);
        assert!(
            BUILD_AT
                .windows(2)
                .all(|w| (0.12..=0.18).contains(&(w[1] - w[0])))
        );
    }

    /// The ring's polygon and the arrow stay inside the GoML disc, so the
    /// white G never spills over the orange.
    #[test]
    fn the_g_sits_inside_the_disc() {
        for [x, y] in ring_polygon().into_iter().chain(ARROW) {
            assert!(
                (x - 18.0).hypot(y - 18.0) < 18.0,
                "({x}, {y}) leaves the disc"
            );
        }
    }

    #[test]
    fn sweep_covers_none_half_and_all_of_the_ring() {
        let poly = circle([50.0, 50.0], 48.0);
        assert!(sweep_poly(&poly, 0.0).0.is_empty());
        let (half, tip) = sweep_poly(&poly, 0.5);
        assert!(half.len() >= 3 && tip.is_some());
        let tip = tip.unwrap();
        assert!(
            (tip[1] - 98.0).abs() < 0.5,
            "half way is 6 o'clock: {tip:?}"
        );
        let (full, tip) = sweep_poly(&poly, 1.0);
        assert_eq!(full.len(), ROUND);
        assert!(tip.is_none());
    }
}
