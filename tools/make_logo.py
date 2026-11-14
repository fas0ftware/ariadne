"""Ariadne logo: a round labyrinth (rings with gaps) and the thread that leads out of it."""
import math, sys
C = 512
def pt(r, deg):
    a = math.radians(deg)
    return C + r * math.cos(a), C + r * math.sin(a)
def arc(r, start, end, sweep=1):
    """SVG arc from angle start to end (degrees, 0 = right, 90 = down)."""
    x1, y1 = pt(r, start); x2, y2 = pt(r, end)
    span = (end - start) % 360 if sweep else (start - end) % 360
    large = 1 if span > 180 else 0
    return f"M{x1:.1f} {y1:.1f}A{r} {r} 0 {large} {sweep} {x2:.1f} {y2:.1f}"
def ring(r, gap_at, gap_deg):
    return arc(r, gap_at + gap_deg / 2, gap_at - gap_deg / 2 + 360, 1)

def svg(bg=True, scale=1.0, ring_color="#5c5c5c", thread="#ffffff", background="#000000"):
    rings = [(92, -90, 52), (172, 90, 30), (252, -90, 22), (332, 90, 17)]  # gaps: top, bottom, top, bottom
    parts = []
    for r, g, d in rings:
        parts.append(f'<path d="{ring(r, g, d)}" stroke="{ring_color}" stroke-width="34" fill="none" stroke-linecap="round"/>')
    # the thread: centre -> up through ring 1 -> around (right) -> down through ring 2 -> around (left)
    # -> up through ring 3 -> around (right) -> down through ring 4 -> out to the ball
    t = [f"M{C} {C}", f"L{C} {C-132}"]
    t.append(arc(132, -90, 90, 1).split("A", 1)[0].replace("M", "L") + "A" + arc(132, -90, 90, 1).split("A", 1)[1])
    t.append(f"L{C} {C+212}")
    t.append("A212 212 0 1 1 " + "%.1f %.1f" % pt(212, -90))
    t.append(f"L{C} {C-292}")
    t.append("A292 292 0 1 1 " + "%.1f %.1f" % pt(292, 90))
    t.append(f"L{C} {C+392}")
    path = " ".join(t)
    thread_el = f'<path d="{path}" stroke="{thread}" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    ball = (f'<circle cx="{C}" cy="{C+392}" r="44" fill="{thread}"/>'
            f'<path d="M{C-34} {C+372}q34 22 68 0M{C-40} {C+394}q40 22 80 0M{C-30} {C+416}q30 18 60 0" stroke="{background}" stroke-width="7" fill="none" stroke-linecap="round"/>')
    centre = f'<circle cx="{C}" cy="{C}" r="22" fill="{thread}"/>'
    g = f'<g transform="translate({C} {C - 36 * scale:.1f}) scale({scale}) translate({-C} {-C})">{"".join(parts)}{thread_el}{centre}{ball}</g>'
    back = f'<rect width="1024" height="1024" fill="{background}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{back}{g}</svg>\n'

if __name__ == "__main__":
    out = sys.argv[1]
    open(f"{out}/logo.svg", "w").write(svg(scale=0.86))                       # icon.png, store, website
    open(f"{out}/logo-transparent.svg", "w").write(svg(bg=False, scale=0.86))
    open(f"{out}/adaptive-fg.svg", "w").write(svg(bg=False, scale=0.6))        # inside the 66 % safe zone
    open(f"{out}/monochrome.svg", "w").write(svg(bg=False, scale=0.6, ring_color="#ffffff", thread="#ffffff", background="#000000"))
    open(f"{out}/splash.svg", "w").write(svg(bg=False, scale=0.86, ring_color="#8a8a8a", thread="#000000", background="#ffffff"))
