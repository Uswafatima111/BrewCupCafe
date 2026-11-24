"""
The Brew Cup Cafe, Jali / Bhatkal - Blender scene builder (Blender 4.x, metres)
Modelled on the owner's real photos: graphite gabled facade with slatted gable + round logo + glass canopy,
vaulted wood ceiling with black steel rafters, mezzanine, rattan pendants, black counter with terracotta brick front,
tan banquette under the coffee mural, olive tree, glass wall to the pool terrace.

Run via the Blender MCP (execute_blender_code) or paste into Blender's Scripting tab.
Before Stage 3, copy the brew-cup-assets/ folder to ASSET_DIR (mural + food photos are used as textures).

Street is -Y, shop interior runs +Y (x -4..4, y 0..6), pool terrace behind (y > 6.2).
Stages: stage1_setup(); stage2_exterior(); stage3_interior(); stage4_lights_camera(); stage5_export()   or run_all()
"""
import bpy, math, os
from mathutils import Vector

OUT_DIR   = os.environ.get("BCC_OUT",    os.path.expanduser("~/brew-cup-cafe/blender"))   # <- set to a folder inside your workspace
ASSET_DIR = os.environ.get("BCC_ASSETS", os.path.expanduser("~/brew-cup-cafe/assets"))      # <- folder holding the brew-cup-assets/*.jpg files
CAFE_NAME = "THE BREW CUP CAFE"
C, M = {}, {}

# Walkthrough: street -> through the door -> counter (frame 180) -> mural -> seating -> glass wall to the pool.
# (frame, camera position, look-at point), Blender coords (x right, y into the shop, z up). Camera stays above furniture.
CAMERA_KEYS = [
    (1,   (0, -14, 1.8),    (0, 0, 2.6)),
    (60,  (0, -6.5, 1.65),  (0, 0, 2.3)),
    (100, (0, -1.5, 1.55),  (0, 3, 1.6)),
    (130, (0, 0.8, 1.5),    (0, 4.2, 1.4)),
    (180, (0, 1.7, 1.45),   (0, 4.2, 1.3)),     # <- "arrived at the counter" (end of intro)
    (230, (-1.2, 1.6, 1.5), (-3.99, 2.1, 1.9)),  # mural wall
    (290, (1.2, 1.8, 1.5),  (2.5, 2.4, 1.3)),    # communal table + olive tree
    (340, (2.7, 3.6, 1.55), (2.7, 7.0, 1.0)),    # toward the glass wall
    (420, (2.7, 7.2, 1.5),  (4.0, 12.0, 0.3)),   # pass through the back glass door to the pool
]
LOGO_EMBLEM = None


# ================================================================ helpers
def mat(name, rgb, rough=0.5, metal=0.0, alpha=1.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    m.diffuse_color = (*rgb, alpha)          # viewport colour (this was missing -> grey scene)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: m.blend_method = 'BLEND'
        m.use_backface_culling = False
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def photo_mat(name, filename, rough=0.8):
    path = os.path.join(ASSET_DIR, filename)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = rough
    m.diffuse_color = (0.6, 0.6, 0.6, 1)
    if os.path.exists(path):
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(path, check_existing=True)
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    else:
        print("!! MISSING IMAGE (flat grey used):", path)
        b.inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
    return m


def photo_quad(name, filename, bl, br, tr, tl, coll):
    """Textured quad. Corners go bottom-left, bottom-right, top-right, top-left AS SEEN by the viewer."""
    me = bpy.data.meshes.new(name); me.from_pydata([bl, br, tr, tl], [], [(0, 1, 2, 3)]); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[i].uv = c
    me.materials.append(photo_mat("MAT_" + name, filename))
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob


def logo_emblem_image():
    """Crop only the circular cup emblem from the supplied logo and make its corners transparent."""
    global LOGO_EMBLEM
    if LOGO_EMBLEM is not None:
        return LOGO_EMBLEM
    path = os.path.join(ASSET_DIR, "logo.jpg")
    source = bpy.data.images.load(path, check_existing=True)
    width, height = map(int, source.size)
    size = min(72, width, height)
    cx, cy = round(width * 0.5), round(height * 0.63)  # Blender image pixels use a bottom-left origin.
    x0, y0 = cx - size // 2, cy - size // 2
    src = list(source.pixels[:])
    pixels = [0.0] * (size * size * 4)
    radius = size * 0.455
    for y in range(size):
        sy = min(height - 1, max(0, y0 + y))
        for x in range(size):
            sx = min(width - 1, max(0, x0 + x))
            si = (sy * width + sx) * 4
            di = (y * size + x) * 4
            pixels[di:di + 3] = src[si:si + 3]
            dist = math.sqrt((x - (size - 1) / 2) ** 2 + (y - (size - 1) / 2) ** 2)
            pixels[di + 3] = max(0.0, min(1.0, radius + 0.5 - dist))
    image = bpy.data.images.new("Logo_Emblem_Cropped", width=size, height=size, alpha=True)
    image.pixels.foreach_set(pixels)
    image.pack()
    LOGO_EMBLEM = image
    return image


def logo_emblem_quad(name, bl, br, tr, tl, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata([bl, br, tr, tl], [], [(0, 1, 2, 3)])
    me.update()
    uv = me.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = coord
    image = logo_emblem_image()
    material = bpy.data.materials.new("MAT_" + name)
    material.use_nodes = True
    material.diffuse_color = (0.06, 0.07, 0.06, 1)
    material.use_backface_culling = False
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    material.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    try: material.surface_render_method = 'BLENDED'
    except Exception: material.blend_method = 'BLEND'
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def to_coll(ob, coll):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    coll.objects.link(ob)


def box(name, x0, x1, y0, y1, z0, z1, m, coll):
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
    f = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    me = bpy.data.meshes.new(name); me.from_pydata(v, [], f); me.update(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob


def slab(name, left, y0, y1, dz0, dz1, m, coll, xe=4.4, ze=3.3, zp=6.0):
    """Sloped roof slab (left or right half) between eave and ridge, vertical offsets dz0..dz1."""
    (xa, za), (xb, zb) = ((-xe, ze), (0, zp)) if left else ((0, zp), (xe, ze))
    v = [(xa,y0,za+dz0),(xb,y0,zb+dz0),(xb,y1,zb+dz0),(xa,y1,za+dz0),
         (xa,y0,za+dz1),(xb,y0,zb+dz1),(xb,y1,zb+dz1),(xa,y1,za+dz1)]
    f = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    me = bpy.data.meshes.new(name); me.from_pydata(v, [], f); me.update(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob


def gable(name, x0, x1, y0, y1, z0, zpeak, m, coll):
    xm = (x0 + x1) / 2
    v = [(x0,y0,z0),(x1,y0,z0),(xm,y0,zpeak),(x0,y1,z0),(x1,y1,z0),(xm,y1,zpeak)]
    f = [(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
    me = bpy.data.meshes.new(name); me.from_pydata(v, [], f); me.update(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob


def cyl(name, r, depth, loc, m, coll, rot=(0,0,0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(m); to_coll(ob, coll)
    return ob


def sphere(name, r, loc, scale, m, coll):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=r, location=loc)
    ob = bpy.context.object; ob.name = name; ob.scale = scale
    ob.data.materials.append(m); to_coll(ob, coll)
    return ob


def text3d(name, body, loc, size, m, coll, extrude=0.02):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi/2, 0, 0))     # faces -Y
    ob = bpy.context.object; ob.name = name
    ob.data.body = body; ob.data.size = size; ob.data.extrude = extrude
    ob.data.align_x = 'CENTER'; ob.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.object; ob.data.materials.append(m); to_coll(ob, coll)
    return ob


def point_light(name, loc, watts, coll, color=(1.0, 0.72, 0.45)):
    l = bpy.data.lights.new(name, 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = 0.15
    ob = bpy.data.objects.new(name, l); ob.location = loc; coll.objects.link(ob)
    return ob


def group(name, objs, coll):
    """Empty parent so React Three Fiber can click the whole thing (INTERACT_ prefix)."""
    e = bpy.data.objects.new(name, None); coll.objects.link(e)
    for o in objs: o.parent = e
    return e


def roof_z(x):
    """Height of the underside of the vaulted ceiling at a given x."""
    return 3.3 + (4.4 - abs(x)) * 2.7 / 4.4


def chair(name, cx, cy, back_dx, seat_m, frame_m, coll):
    box(f"{name}_Seat", cx-0.2, cx+0.2, cy-0.2, cy+0.2, 0.42, 0.47, seat_m, coll)
    bx = cx + (0.17 if back_dx > 0 else -0.21)
    box(f"{name}_Back", bx, bx+0.04, cy-0.2, cy+0.2, 0.47, 0.9, seat_m, coll)
    for lx in (-0.17, 0.17):
        for ly in (-0.17, 0.17):
            box(f"{name}_Leg_{lx}_{ly}", cx+lx-0.015, cx+lx+0.015, cy+ly-0.015, cy+ly+0.015, 0, 0.42, frame_m, coll)


# ================================================================ stage 1
def stage1_setup():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for d in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for x in list(d): d.remove(x)
    for n in ("Exterior", "Pool", "Interior", "Furniture", "Interactive", "Lighting", "Camera"):
        c = bpy.data.collections.new(n); bpy.context.scene.collection.children.link(c); C[n] = c
    M.update(
        wood_dark = mat("MAT_WoodDark",  (0.10, 0.055, 0.03), 0.5),
        wood_light= mat("MAT_WoodLight", (0.42, 0.26, 0.14), 0.55),
        ceiling   = mat("MAT_CeilingWood", (0.38, 0.16, 0.07), 0.55),
        oak       = mat("MAT_Oak",       (0.55, 0.30, 0.10), 0.45),
        cream     = mat("MAT_Cream",     (0.85, 0.80, 0.70), 0.8),
        copper    = mat("MAT_Copper",    (0.72, 0.38, 0.18), 0.3, 1.0),
        charcoal  = mat("MAT_Charcoal",  (0.03, 0.03, 0.035), 0.6),
        marble    = mat("MAT_Marble",    (0.85, 0.84, 0.82), 0.2),
        pavement  = mat("MAT_Pavement",  (0.12, 0.12, 0.13), 0.9),
        tile      = mat("MAT_FloorTile", (0.55, 0.55, 0.53), 0.45),
        brick     = mat("MAT_Terracotta",(0.45, 0.17, 0.09), 0.7),
        leather   = mat("MAT_TanLeather",(0.62, 0.30, 0.12), 0.55),
        glass     = mat("MAT_Glass",     (0.46, 0.70, 0.82), 0.08, 0.0, alpha=0.18),
        pastry    = mat("MAT_Pastry",    (0.6, 0.35, 0.14), 0.7),
        ceramic   = mat("MAT_Ceramic",   (0.9, 0.9, 0.88), 0.25),
        steel     = mat("MAT_Steel",     (0.6, 0.6, 0.62), 0.25, 1.0),
        glow      = mat("MAT_WarmGlow",  (1, 0.7, 0.4), 0.4, emit=(1, 0.65, 0.3), emit_strength=6.0),
        rattan    = mat("MAT_Rattan",    (0.75, 0.52, 0.24), 0.8, emit=(1, 0.6, 0.25), emit_strength=1.5),
        strip     = mat("MAT_LightStrip",(1, 1, 1), 0.3, emit=(1, 1, 1), emit_strength=8.0),
        plant     = mat("MAT_Plant",     (0.08, 0.22, 0.09), 0.8),
        graphite  = mat("MAT_Graphite",  (0.06, 0.065, 0.07), 0.45, 0.3),
        slat      = mat("MAT_Slat",      (0.55, 0.22, 0.10), 0.6),
        brand_green = mat("MAT_BrandGreen", (0.01, 0.09, 0.05), 0.5),
        gold      = mat("MAT_Gold",      (0.75, 0.52, 0.18), 0.3, 1.0),
        sign_white= mat("MAT_SignWhite", (1, 1, 1), 0.4, emit=(1, 0.95, 0.85), emit_strength=3.0),
        pool_tile = mat("MAT_PoolTile",  (0.10, 0.42, 0.62), 0.2, emit=(0.05, 0.3, 0.5), emit_strength=0.4),
        clad_light= mat("MAT_CladLight", (0.52, 0.53, 0.55), 0.5, 0.2),
        clad_dark = mat("MAT_CladDark",  (0.16, 0.17, 0.19), 0.5, 0.2),
        wood_deck = mat("MAT_DeckWood",  (0.62, 0.34, 0.18), 0.6),
        granite   = mat("MAT_Granite",   (0.55, 0.55, 0.52), 0.5),
        curtain   = mat("MAT_Curtain",   (0.92, 0.89, 0.82), 0.9),
        hedge     = mat("MAT_Hedge",     (0.10, 0.28, 0.08), 0.9),
        grass     = mat("MAT_Grass",     (0.17, 0.30, 0.10), 0.95),
        asphalt   = mat("MAT_Asphalt",   (0.10, 0.10, 0.11), 0.95),
        concrete  = mat("MAT_Concrete",  (0.60, 0.60, 0.58), 0.9),
        lounger   = mat("MAT_Lounger",   (0.15, 0.30, 0.80), 0.5),
        trunk     = mat("MAT_PalmTrunk", (0.36, 0.27, 0.18), 0.9),
        frond     = mat("MAT_PalmFrond", (0.14, 0.34, 0.08), 0.8),
        water     = mat("MAT_Water",     (0.2, 0.6, 0.9), 0.05, 0.0, alpha=0.45),
    )
    print("stage1 ok")


# ================================================================ exterior helpers (photo-matched rebuild)
def mesh_obj(name, verts, faces, m, coll):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob


def poly_prism(name, pts, v0, v1, mp, m, coll):
    """Extrude a convex (u,z) polygon between depths v0..v1. mp(u,v)->(x,y) places it in the world."""
    n = len(pts); V = []
    for v in (v0, v1):
        for (u, z) in pts:
            x, y = mp(u, v); V.append((x, y, z))
    F = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n; F.append((i, j, n + j, n + i))
    return mesh_obj(name, V, F, m, coll)


def gable_frame(name, outer, inner, v0, v1, mp, m_front, m_side, coll):
    """Thick cladding band around a gable opening (open at the bottom: piers run to the ground)."""
    P = lambda pt, v: (*mp(pt[0], v), pt[1])
    Vf, Ff, Vs, Fs = [], [], [], []
    for i in range(len(outer) - 1):
        a, b, c, d = outer[i], outer[i + 1], inner[i + 1], inner[i]
        k = len(Vf); Vf += [P(a, v0), P(b, v0), P(c, v0), P(d, v0)]; Ff.append((k, k + 1, k + 2, k + 3))
        k = len(Vs); Vs += [P(a, v0), P(b, v0), P(b, v1), P(a, v1)]; Fs.append((k, k + 1, k + 2, k + 3))
        k = len(Vs); Vs += [P(d, v0), P(c, v0), P(c, v1), P(d, v1)]; Fs.append((k, k + 1, k + 2, k + 3))
    mesh_obj(name, Vf, Ff, m_front, coll); mesh_obj(name + "_Reveal", Vs, Fs, m_side, coll)


def wbox(name, mp, u0, u1, v0, v1, z0, z1, m, coll):
    (xa, ya), (xb, yb) = mp(u0, v0), mp(u1, v1)
    return box(name, min(xa, xb), max(xa, xb), min(ya, yb), max(ya, yb), z0, z1, m, coll)


def gable_wing(name, mp, w, depth, wh, rh, fh, bays, coll, frame_m, ft=0.55):
    """Two-storey glazed gable (photo 5): light cladding frame, black mullions, white curtains, floor band."""
    hw = w / 2; sl = (rh - wh) / hw; ih = hw - ft
    top = lambda u: wh + sl * (hw - abs(u)) - ft * 1.15 - 0.05
    outer = [(hw, 0), (hw, wh), (0, rh), (-hw, wh), (-hw, 0)]
    inner = [(ih, 0), (ih, top(ih)), (0, top(0)), (-ih, top(ih)), (-ih, 0)]
    poly_prism(name + "_Body", [(-hw, 0), (hw, 0), (hw, wh), (0, rh), (-hw, wh)], 0.45, depth, mp, M["clad_dark"], coll)
    gable_frame(name + "_Frame", outer, inner, -0.3, 0.45, mp, frame_m, M["clad_dark"], coll)
    poly_prism(name + "_Glass", [(ih, 0.2), (ih, top(ih)), (0, top(0)), (-ih, top(ih)), (-ih, 0.2)], 0.06, 0.09, mp, M["glass"], coll)
    wbox(name + "_FloorBand", mp, -ih, ih, -0.12, 0.3, fh - 0.22, fh + 0.22, M["clad_dark"], coll)
    step = 2 * ih / bays
    for k in range(bays + 1):
        u = -ih + k * step
        wbox(f"{name}_Mullion_{k}", mp, u - 0.04, u + 0.04, 0.0, 0.14, 0.2, max(top(u), 0.4), M["charcoal"], coll)
        if k < bays:
            for j in range(3):
                uj = u + (j + 0.5) * step / 3
                wbox(f"{name}_CurtainLo_{k}_{j}", mp, uj - 0.17, uj + 0.17, 0.2, 0.28, 0.25, fh - 0.3, M["curtain"], coll)
                zt = top(uj) - 0.2
                if zt > fh + 0.8:
                    wbox(f"{name}_CurtainHi_{k}_{j}", mp, uj - 0.17, uj + 0.17, 0.2, 0.28, fh + 0.3, zt, M["curtain"], coll)


def flat_bay(name, mp, w, depth, h, fh, bays, coll):
    """Flat-roofed glazed two-storey bay (right part of photos 2 and 7)."""
    hw = w / 2
    wbox(name + "_Body", mp, -hw, hw, 0.3, depth, 0, h, M["clad_dark"], coll)
    wbox(name + "_Roof", mp, -hw - 0.3, hw + 0.3, -0.7, depth + 0.2, h, h + 0.35, M["charcoal"], coll)
    wbox(name + "_Glass", mp, -hw + 0.35, hw - 0.35, 0.1, 0.13, 0.2, h - 0.1, M["glass"], coll)
    wbox(name + "_FloorBand", mp, -hw, hw, -0.1, 0.3, fh - 0.2, fh + 0.2, M["clad_dark"], coll)
    wbox(name + "_PierL", mp, -hw, -hw + 0.35, -0.2, 0.3, 0, h, M["clad_light"], coll)
    wbox(name + "_PierR", mp, hw - 0.35, hw, -0.2, 0.3, 0, h, M["clad_light"], coll)
    step = (w - 0.7) / bays
    for k in range(bays + 1):
        u = -hw + 0.35 + k * step
        wbox(f"{name}_Mullion_{k}", mp, u - 0.04, u + 0.04, 0.05, 0.16, 0.2, h - 0.1, M["charcoal"], coll)
        if k < bays:
            for j in range(3):
                uj = u + (j + 0.5) * step / 3
                wbox(f"{name}_CurtainLo_{k}_{j}", mp, uj - 0.17, uj + 0.17, 0.22, 0.3, 0.25, fh - 0.3, M["curtain"], coll)
                wbox(f"{name}_CurtainHi_{k}_{j}", mp, uj - 0.17, uj + 0.17, 0.22, 0.3, fh + 0.3, h - 0.3, M["curtain"], coll)


def deck_with_holes(name, bounds, holes, m, coll, z0=-0.12, z1=-0.01):
    xs = sorted({bounds[0], bounds[1]} | {h[i] for h in holes for i in (0, 1) if bounds[0] < h[i] < bounds[1]})
    ys = sorted({bounds[2], bounds[3]} | {h[i] for h in holes for i in (2, 3) if bounds[2] < h[i] < bounds[3]})
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if any(h[0] < cx < h[1] and h[2] < cy < h[3] for h in holes):
                continue
            box(f"{name}_{i}_{j}", xs[i], xs[i + 1], ys[j], ys[j + 1], z0, z1, m, coll)


def pool_basin(name, x0, x1, y0, y1, depth, coll, tex=None, cope=0.4):
    """Tiled basin + granite coping. Returns the deck hole (coping outer rectangle)."""
    for tag, a, b, c, d in (("S", x0 - .1, x1 + .1, y0 - .1, y0), ("N", x0 - .1, x1 + .1, y1, y1 + .1),
                            ("W", x0 - .1, x0, y0, y1), ("E", x1, x1 + .1, y0, y1)):
        box(f"{name}_Wall{tag}", a, b, c, d, -depth, 0.0, M["pool_tile"], coll)
    if tex:
        photo_quad(name + "_Floor", tex, (x0, y0, -depth), (x1, y0, -depth), (x1, y1, -depth), (x0, y1, -depth), coll)
    else:
        box(name + "_Floor", x0, x1, y0, y1, -depth - 0.1, -depth, M["pool_tile"], coll)
    box(name + "_Water", x0, x1, y0, y1, -0.22, -0.2, M["water"], coll)
    for tag, a, b, c, d in (("S", x0 - cope, x1 + cope, y0 - cope, y0), ("N", x0 - cope, x1 + cope, y1, y1 + cope),
                            ("W", x0 - cope, x0, y0, y1), ("E", x1, x1 + cope, y0, y1)):
        box(f"{name}_Coping{tag}", a, b, c, d, -0.01, 0.07, M["granite"], coll)
    return (x0 - cope, x1 + cope, y0 - cope, y1 + cope)


def palm(name, x, y, h, coll, seed=0):
    cyl(name + "_Trunk", 0.17, h, (x, y, h / 2), M["trunk"], coll, verts=8)
    for k in range(10):
        a = (k / 10) * 2 * math.pi + seed
        up = 0.9 if k % 3 == 0 else 0.0
        L = 3.4 - 0.5 * (k % 2)
        ux, uy = math.cos(a), math.sin(a); px, py = -uy, ux
        c = (x, y, h)
        mid = (x + ux * L * 0.55, y + uy * L * 0.55, h + 0.35 + up * 0.5)
        tip = (x + ux * L, y + uy * L, h - 1.3 + up)
        V = [c, (mid[0] + px * 0.45, mid[1] + py * 0.45, mid[2]), (mid[0] - px * 0.45, mid[1] - py * 0.45, mid[2]), tip]
        mesh_obj(f"{name}_Frond_{k}", V, [(0, 1, 2), (1, 3, 2)], M["frond"], coll)


# ================================================================ stage 2
def stage2_exterior():
    E, P = C["Exterior"], C["Pool"]
    ident = lambda u, v: (u, v)                      # world-aligned mapping for the main cafe frame

    # ---- ground, street, steps (photo 1: pale pavers, wood steps, planters with clipped hedges)
    box("Ground_Grass", -90, 90, -40, 90, -0.7, -0.36, M["grass"], E)
    box("Road", -90, 90, -26, -10.2, -0.45, -0.3, M["asphalt"], E)
    box("Pavement", -30, 30, -10.2, -3.2, -0.45, -0.2, M["concrete"], E)
    box("Kerb", -30, 30, -10.4, -10.2, -0.45, -0.1, M["cream"], E)
    box("Forecourt_Back", -30, 30, -3.2, 1.5, -0.45, -0.2, M["concrete"], E)
    box("Step_Lower", -5.6, 5.6, -3.2, -1.7, -0.45, -0.1, M["wood_deck"], E)
    box("Step_Upper", -5.6, 5.6, -1.7, 0.0, -0.45, -0.01, M["wood_deck"], E)
    box("Step_Nosing_Lower", -5.6, 5.6, -3.24, -3.2, -0.45, -0.08, M["granite"], E)
    box("Step_Nosing_Upper", -5.6, 5.6, -1.74, -1.7, -0.45, 0.0, M["granite"], E)
    for i, (xa, xb) in enumerate(((-10.2, -6.0), (6.0, 10.2))):
        box(f"Planter_{i}", xa, xb, -3.4, -1.2, -0.45, 0.45, M["clad_dark"], E)
        box(f"Hedge_{i}", xa + 0.1, xb - 0.1, -3.3, -1.3, 0.45, 1.1, M["hedge"], E)
    for i, x in enumerate((-5.9, -3.0, 3.0, 5.9)):
        cyl(f"Bollard_{i}", 0.07, 0.7, (x, -3.6, 0.0), M["charcoal"], E, verts=10)
        cyl(f"Bollard_Lamp_{i}", 0.075, 0.05, (x, -3.6, 0.38), M["glow"], E, verts=10)

    # ---- cafe shell (interior dimensions unchanged)
    box("Floor", -4, 4, 0, 6, -0.1, 0, M["tile"], E)
    box("Wall_Left",  -4.2, -4.0, 0, 6.2, 0, 3.3, M["graphite"], E)
    # Right side: three tall glazed bays between full-height black steel posts.
    box("Side_Right_Sill", 4.0, 4.2, 0.0, 6.2, 0.0, 0.9, M["graphite"], E)
    box("Side_Right_Header", 4.0, 4.2, 0.0, 6.2, 3.0, 3.3, M["graphite"], E)
    for i, y in enumerate((0.0, 2.0, 4.0, 6.0)):
        box(f"Side_Right_Post_{i}", 3.98, 4.22, y - 0.055, y + 0.055, 0.0, 3.3, M["charcoal"], E)
    for i, (y0, y1) in enumerate(((0.08, 1.92), (2.08, 3.92), (4.08, 6.12))):
        box(f"Side_Right_Glass_{i}", 4.04, 4.16, y0, y1, 0.94, 2.96, M["glass"], E)
        box(f"Side_Right_SillFrame_{i}", 3.99, 4.21, y0 - 0.04, y1 + 0.04, 0.86, 0.94, M["charcoal"], E)
        box(f"Side_Right_HeadFrame_{i}", 3.99, 4.21, y0 - 0.04, y1 + 0.04, 2.96, 3.04, M["charcoal"], E)

    # Rear curtain wall. Keep the 1.5..3.7 m central door portal clear at eye level.
    rear_bays = ((-4.0, -2.4), (-2.4, -0.8), (-0.8, 0.8), (0.8, 1.5), (3.7, 4.0))
    for i, (x0, x1) in enumerate(rear_bays):
        box(f"Back_Glass_Bay_{i}", x0, x1, 6.08, 6.12, 0.0, 3.3, M["glass"], E)
    box("Back_Glass_Door_Transom", 1.5, 3.7, 6.08, 6.12, 2.84, 3.3, M["glass"], E)
    for i, x in enumerate((-4.0, -2.4, -0.8, 0.8, 1.5, 3.7, 4.0)):
        box(f"Back_Mullion_{i}", x - 0.045, x + 0.045, 6.0, 6.2, 0.0, 3.3, M["charcoal"], E)
    for z in (1.1, 2.2):
        for tag, x0, x1 in (("L", -4.0, 1.5), ("R", 3.7, 4.0)):
            box(f"Back_Transom_{tag}_{z}", x0, x1, 6.0, 6.2, z - 0.045, z + 0.045, M["charcoal"], E)
    box("Back_Transom_Cladding", -4.0, 4.0, 6.0, 6.2, 3.25, 3.35, M["charcoal"], E)
    # Open glass door leaves sit along the jambs, leaving a clear camera-width passage.
    box("Back_Door_Frame_L", 1.43, 1.52, 6.0, 6.2, 0.0, 2.84, M["charcoal"], E)
    box("Back_Door_Frame_R", 3.68, 3.77, 6.0, 6.2, 0.0, 2.84, M["charcoal"], E)
    box("Back_Door_Frame_Head", 1.5, 3.7, 6.0, 6.2, 2.76, 2.86, M["charcoal"], E)
    box("Back_Door_Leaf_L", 1.51, 1.57, 6.0, 7.1, 0.04, 2.76, M["glass"], E)
    box("Back_Door_Leaf_R", 3.63, 3.69, 6.0, 7.1, 0.04, 2.76, M["glass"], E)
    box("Back_Door_Handle_L", 1.57, 1.62, 6.48, 6.55, 1.1, 1.45, M["steel"], E)
    box("Back_Door_Handle_R", 3.58, 3.63, 6.48, 6.55, 1.1, 1.45, M["steel"], E)
    # Upper glass follows the roof rake all the way to the 6.45 m ridge.
    mesh_obj("Back_Gable_Glass", [(-4.2, 6.11, 3.45), (4.2, 6.11, 3.45), (0.0, 6.11, 6.45)], [(0, 1, 2)], M["glass"], E)
    for i, x in enumerate((-4.0, -2.4, -0.8, 0.8, 2.4, 4.0)):
        top_z = 6.45 - abs(x) * (6.45 - 3.3) / 4.4
        box(f"Back_Gable_Mullion_{i}", x - 0.045, x + 0.045, 6.0, 6.2, 3.3, top_z, M["charcoal"], E)

    for left, tag in ((True, "L"), (False, "R")):
        slab(f"Roof_Inner_{tag}", left, -0.8, 6.3, 0.0, 0.08, M["ceiling"], E, zp=6.45)
        slab(f"Roof_Outer_{tag}", left, -0.8, 6.3, 0.08, 0.16, M["graphite"], E, zp=6.45)
    gable("Gable_Front", -4.4, 4.4, -0.1, 0.25, 3.3, 6.45, M["graphite"], E)
    # Matching rear gable frame projects 0.6 m outward over the pool side.
    outer = [(4.6, 0), (4.6, 3.45), (0, 6.45), (-4.6, 3.45), (-4.6, 0)]
    inner = [(3.55, 0), (3.55, 3.06), (0, 5.38), (-3.55, 3.06), (-3.55, 0)]
    gable_frame("Back_Frame", outer, inner, 6.2, 6.8, ident, M["clad_light"], M["clad_dark"], E)
    # Repeat the facade terracotta louvres on the courtyard side of the glazed gable.
    z = 3.55
    while z < 5.15:
        hw = min(3.5, (5.26 - z) / 0.652 - 0.05)
        box(f"Back_Louvre_{round(z, 2)}", -hw, hw, 6.0, 6.06, z, z + 0.10, M["slat"], E)
        z += 0.17
    for k, y in enumerate((1.0, 2.5, 4.0)):
        for left, tag in ((True, "L"), (False, "R")):
            slab(f"Rafter_{tag}_{k}", left, y, y + 0.1, -0.14, 0.0, M["charcoal"], E)
        box(f"TieBeam_{k}", -4.0, 4.0, y, y + 0.1, 3.18, 3.28, M["charcoal"], E)

    # ---- facade (photo: facade_day): deep grey cladding frame, terracotta louvres, medallion, glass canopy
    outer = [(4.6, 0), (4.6, 3.45), (0, 6.45), (-4.6, 3.45), (-4.6, 0)]
    inner = [(3.55, 0), (3.55, 3.06), (0, 5.38), (-3.55, 3.06), (-3.55, 0)]
    gable_frame("Facade_Frame", outer, inner, -0.9, 0.25, ident, M["clad_light"], M["clad_dark"], E)
    box("Facade_Header", -3.55, 3.55, -0.12, 0.25, 3.3, 3.5, M["charcoal"], E)         # beam under the louvres
    box("Facade_MidMullion", -0.06, 0.06, -0.16, 0.0, 3.5, 5.3, M["charcoal"], E)
    z = 3.55
    while z < 5.15:
        hw = min(3.5, (5.26 - z) / 0.652 - 0.05)
        for s, (a, b) in enumerate(((-hw, -0.08), (0.08, hw))):
            box(f"Louvre_{round(z, 2)}_{s}", a, b, -0.14, -0.06, z, z + 0.10, M["slat"], E)
        z += 0.17
    # glazed transom + shopfront below the beam (door x +-0.7, windows x +-1.0..3.5)
    for nm, a, b, z0, z1 in [("Front_PierL", -4.2, -3.5, 0, 3.3), ("Front_PierR", 3.5, 4.2, 0, 3.3),
                             ("Front_MidL", -1.0, -0.7, 0, 2.5), ("Front_MidR", 0.7, 1.0, 0, 2.5),
                             ("Front_SillL", -3.5, -1.0, 0, 0.8), ("Front_SillR", 1.0, 3.5, 0, 0.8),
                             ("Front_DoorHead", -0.7, 0.7, 2.4, 2.5)]:
        box(nm, a, b, 0, 0.25, z0, z1, M["graphite"], E)
    box("Transom_Glass", -3.5, 3.5, 0.10, 0.13, 2.5, 3.3, M["glass"], E)
    for i, x in enumerate((-3.5, -1.75, 0.0, 1.75, 3.5)):
        box(f"Transom_Mullion_{i}", x - 0.04, x + 0.04, 0.0, 0.2, 2.5, 3.3, M["charcoal"], E)
    box("Transom_Rail", -3.5, 3.5, 0.0, 0.2, 2.46, 2.54, M["charcoal"], E)
    for nm, a, b in [("Window_L", -3.5, -1.0), ("Window_R", 1.0, 3.5)]:
        box(nm + "_Glass", a, b, 0.10, 0.13, 0.8, 2.5, M["glass"], E)
    for i, x in enumerate((-2.25, -1.5, 1.5, 2.25)):
        box(f"Window_Mullion_{i}", x - 0.03, x + 0.03, 0.0, 0.2, 0.8, 2.5, M["charcoal"], E)
    box("Door_Leaf_L", -0.72, -0.68, 0.25, 1.15, 0, 2.4, M["glass"], E)
    box("Door_Leaf_R",  0.68,  0.72, 0.25, 1.15, 0, 2.4, M["glass"], E)
    box("Door_Handle_L", -0.75, -0.65, 1.0, 1.05, 0.9, 1.3, M["copper"], E)
    box("Door_Handle_R",  0.65,  0.75, 1.0, 1.05, 0.9, 1.3, M["copper"], E)
    # signage: round medallion above, white 3D letters THE / BREW CUP / CAFE on the louvres
    cyl("Logo_Ring", 0.52, 0.06, (0, -0.2, 4.8), M["gold"], E, rot=(math.pi/2, 0, 0), verts=48)
    cyl("Logo_Disc", 0.46, 0.07, (0, -0.22, 4.8), M["charcoal"], E, rot=(math.pi/2, 0, 0), verts=48)
    logo_emblem_quad("Logo_Photo", (-0.38, -0.27, 4.42), (0.38, -0.27, 4.42), (0.38, -0.27, 5.18), (-0.38, -0.27, 5.18), E)
    text3d("Sign_THE", "THE", (0, -0.19, 4.2), 0.17, M["sign_white"], E)
    text3d("Sign_BREWCUP", "BREW CUP", (0, -0.19, 3.85), 0.40, M["sign_white"], E)
    text3d("Sign_CAFE", "CAFE", (0, -0.19, 3.52), 0.17, M["sign_white"], E)
    # glass canopy on black steel beams with stand-off brackets
    box("Canopy_Glass", -3.5, 3.5, -1.5, -0.08, 2.40, 2.44, M["glass"], E)
    box("Canopy_Beam_Front", -3.5, 3.5, -1.56, -1.44, 2.28, 2.46, M["charcoal"], E)
    box("Canopy_Beam_Back", -3.5, 3.5, -0.2, -0.08, 2.28, 2.46, M["charcoal"], E)
    for i in range(8):
        x = -3.45 + i * 6.9 / 7
        box(f"Canopy_Rib_{i}", x - 0.05, x + 0.05, -1.5, -0.08, 2.28, 2.40, M["charcoal"], E)
        box(f"Canopy_Bracket_{i}", x - 0.02, x + 0.02, -1.4, -1.36, 2.44, 2.56, M["steel"], E)

    # ---- tall slatted building left of the cafe (photo 1)
    box("LeftBlock_Body", -17, -4.6, 1.5, 8.5, -0.3, 10.6, M["clad_light"], E)
    box("LeftBlock_Roof", -17.2, -4.4, 1.2, 8.7, 10.6, 10.95, M["charcoal"], E)
    for fl in range(3):
        z0 = 0.3 + fl * 3.5
        box(f"LeftBlock_Glass_{fl}", -16.4, -5.2, 1.44, 1.5, z0 + 0.3, z0 + 2.5, M["glass"], E)
        for k in range(6):
            zz = z0 + 0.3 + k * 0.4
            box(f"LeftBlock_Fin_{fl}_{k}", -16.6, -5.0, 1.15, 1.35, zz, zz + 0.1, M["clad_dark"], E)
        for k in range(5):
            x = -16.6 + k * 2.9
            box(f"LeftBlock_Post_{fl}_{k}", x, x + 0.12, 1.15, 1.35, z0, z0 + 2.9, M["charcoal"], E)

    # ---- right block (photo 1, right edge)
    # Keep a 3.4 m lightwell beyond the cafe's new right-side glazing.
    box("RightBlock_Body", 7.6, 14.5, 1.0, 8.0, -0.3, 5.6, M["clad_dark"], E)
    box("RightBlock_Glass", 8.2, 14.0, 0.94, 1.0, 0.9, 3.6, M["glass"], E)
    for k in range(4):
        box(f"RightBlock_Mullion_{k}", 8.2 + k * 1.93, 8.3 + k * 1.93, 0.9, 1.05, 0.9, 3.6, M["charcoal"], E)

    # ---- pool courtyard (photos 2-5, 7-8): wood-look deck, mosaic pool with gold emblem, granite coping
    mainpool = pool_basin("Pool", -3.5, 11.0, 10.0, 22.4, 1.4, P, tex="pool_mosaic.png")
    plunge   = pool_basin("Plunge", -8.8, -5.7, 12.2, 15.3, 1.0, P)
    pool2    = pool_basin("PoolB", -8.8, -5.7, 17.3, 20.4, 0.9, P)
    shallow  = pool_basin("PoolC", 12.4, 15.6, 10.0, 13.6, 0.8, P)
    holes = [mainpool, plunge, pool2, shallow, (-17, -4.6, 1.5, 8.5), (7.6, 14.5, 1.0, 8.0)]
    deck_with_holes("Deck", (-13.5, 16.5, 6.2, 24.0), holes, M["wood_deck"], P)
    box("Walkway", -13.5, 16.5, 24.0, 27.2, -0.12, 0.0, M["concrete"], P)
    # stepping-stone ledge across the near end of the pool
    for i, (a, b) in enumerate(((-3.5, 3.6), (4.8, 11.0))):
        box(f"Ledge_{i}", a, b, 11.2, 12.2, -0.9, 0.05, M["granite"], P)
    # glass railing along the walkway
    box("Railing_Glass", -3.5, 11.0, 23.5, 23.55, 0.0, 1.1, M["glass"], P)
    box("Railing_Rail", -3.5, 11.0, 23.48, 23.58, 1.1, 1.15, M["steel"], P)
    for i in range(10):
        x = -3.5 + i * 14.5 / 9
        box(f"Railing_Post_{i}", x - 0.03, x + 0.03, 23.47, 23.59, 0.0, 1.1, M["steel"], P)
    # black slatted pergola cube over the plunge pool
    px0, px1, py0, py1 = -9.0, -5.5, 12.0, 15.5
    for i, (x, y) in enumerate(((px0, py0), (px1 - 0.12, py0), (px0, py1 - 0.12), (px1 - 0.12, py1 - 0.12))):
        box(f"Pergola_Post_{i}", x, x + 0.12, y, y + 0.12, 0, 3.0, M["charcoal"], P)
    box("Pergola_Roof", px0 - 0.1, px1 + 0.1, py0 - 0.1, py1 + 0.1, 3.0, 3.14, M["steel"], P)
    for i in range(8):
        t = 0.2 + i * 0.42
        box(f"Pergola_Slat_N_{i}", px0 + t, px0 + t + 0.07, py1 - 0.05, py1, 0.1, 3.0, M["charcoal"], P)
        box(f"Pergola_Slat_S_{i}", px0 + t, px0 + t + 0.07, py0, py0 + 0.05, 0.1, 3.0, M["charcoal"], P)
        box(f"Pergola_Slat_W_{i}", px0, px0 + 0.05, py0 + t, py0 + t + 0.07, 0.1, 3.0, M["charcoal"], P)
    box("Lounger", -11.5, -10.4, 18.0, 20.0, 0.0, 0.35, M["lounger"], P)

    # ---- wings around the courtyard
    gable_wing("WingA", lambda u, v: (-1.5 + u, 27.0 + v), 9.0, 12.0, 6.6, 9.0, 3.4, 4, E, M["clad_light"])
    flat_bay("WingB", lambda u, v: (8.3 + u, 27.4 + v), 9.4, 10.0, 6.6, 3.4, 4, E)
    flat_bay("WingL", lambda u, v: (-11.5 + u, 26.6 + v), 9.0, 10.0, 6.2, 3.2, 4, E)
    gable_wing("WingR", lambda u, v: (16.5 + v, 18.0 + u), 9.0, 10.0, 6.4, 8.6, 3.3, 4, E, M["clad_light"])

    # ---- palms (coconut grove all around, as in every photo) and a few street-side plants
    pts = [(-14, 30, 10), (-17, 36, 11), (-6, 44, 10.5), (2, 46, 11), (10, 44, 10), (19, 40, 10.5),
           (24, 30, 9.5), (27, 20, 10), (21, 8, 9), (-19, 22, 9), (-20, 12, 9.5), (-13, 24, 8.5),
           (17.5, 26, 9), (13, 0, 8.5), (-22, 6, 9)]
    for i, (x, y, h) in enumerate(pts):
        palm(f"Palm_{i}", x, y, h, E, seed=i * 0.7)
    point_light("Light_Pool_A", (2.5, 13, -0.6), 120, P, (0.3, 0.6, 1.0))
    point_light("Light_Pool_B", (7.0, 18, -0.6), 120, P, (0.3, 0.6, 1.0))
    print("stage2 ok")


# ================================================================ stage 3
def stage3_interior():
    I, F, X = C["Interior"], C["Furniture"], C["Interactive"]
    # --- back bar (left of the pool opening) + shelves + espresso machine
    box("BackBar_Base", -3.2, 1.3, 5.0, 5.65, 0, 0.95, M["brick"], I)
    box("BackBar_Top",  -3.3, 1.4, 4.95, 5.65, 0.95, 1.0, M["charcoal"], I)
    for i, z in enumerate((1.5, 1.85)):
        box(f"Shelf_{i}", -2.8, 1.1, 5.35, 5.62, z, z + 0.04, M["wood_light"], I)
        for k in range(8):
            cyl(f"Cup_{i}_{k}", 0.045, 0.09, (-2.5 + k * 0.5, 5.47, z + 0.085), M["ceramic"], I, verts=12)
    box("Espresso_Body", -0.6, 0.6, 5.1, 5.55, 1.0, 1.4, M["charcoal"], I)
    box("Espresso_Top", -0.62, 0.62, 5.08, 5.57, 1.4, 1.45, M["steel"], I)
    cyl("Grinder", 0.12, 0.4, (0.95, 5.3, 1.2), M["charcoal"], I)
    box("MenuBoard", -1.4, 1.0, 5.58, 5.63, 2.05, 2.6, M["charcoal"], I)
    text3d("MenuBoard_Text", "MENU", (-0.2, 5.56, 2.32), 0.28, M["cream"], I)
    box("Logo_Poster_Backing", -2.78, -2.14, 5.70, 5.76, 1.95, 2.65, M["charcoal"], I)
    logo_emblem_quad("Logo_Poster", (-2.75, 5.69, 2.00), (-2.17, 5.69, 2.00), (-2.17, 5.69, 2.58), (-2.75, 5.69, 2.58), I)
    # --- mezzanine over the back bar, with glass railing and stair
    box("Mezz_Floor", -4.0, 4.0, 4.8, 6.0, 2.7, 2.8, M["oak"], I)
    box("Mezz_Beam", -4.0, 4.0, 4.76, 4.84, 2.55, 2.7, M["charcoal"], I)
    box("Mezz_Glass", -4.0, 4.0, 4.78, 4.8, 2.8, 3.4, M["glass"], I)
    box("Mezz_Handrail", -4.0, 4.0, 4.76, 4.84, 3.4, 3.44, M["charcoal"], I)
    for k in range(9):
        box(f"Stair_{k}", 3.3, 3.9, 2.55 + 0.25 * k, 4.8, 0, 0.3 * (k + 1), M["oak"], I)
    # --- mural wall (left) with tan banquette
    photo_quad("Mural", "mural.jpg", (-3.99, 0.9, 1.05), (-3.99, 3.3, 1.05), (-3.99, 3.3, 2.85), (-3.99, 0.9, 2.85), I)
    box("Banquette_Seat", -3.99, -3.45, 0.8, 3.4, 0, 0.45, M["leather"], F)
    box("Banquette_Back", -3.99, -3.85, 0.8, 3.4, 0.45, 0.95, M["leather"], F)
    # --- food photo frames on the solid left wall, clear of the new right-side windows
    for k, (fn, ya) in enumerate((("food_pasta_red.jpg", 0.55), ("food_pasta_creamy.jpg", 1.2), ("drink_pink_slush.jpg", 1.85))):
        yb = ya + 0.5
        y0 = 3.55 + k * 0.68
        y1 = y0 + 0.5
        box(f"Frame_{k}", -4.0, -3.96, y0 - 0.03, y1 + 0.03, 1.37, 2.0, M["charcoal"], I)
        photo_quad(f"Photo_{k}", fn, (-3.955, y0, 1.4), (-3.955, y1, 1.4), (-3.955, y1, 1.97), (-3.955, y0, 1.97), I)
    # --- cashier counter: black top, terracotta brick front
    box("Counter_Base", -1.8, 1.8, 3.6, 4.5, 0, 1.05, M["charcoal"], F)
    box("Counter_Top",  -1.9, 1.9, 3.5, 4.6, 1.05, 1.10, M["charcoal"], F)
    box("Counter_Brick_Front", -1.8, 1.8, 3.46, 3.5, 0.15, 1.0, M["brick"], F)
    box("PickUp_Plate", 1.0, 1.5, 3.44, 3.46, 0.78, 0.9, M["ceramic"], F)
    text3d("PickUp_Text", "PICK UP", (1.25, 3.43, 0.84), 0.07, M["charcoal"], F, extrude=0.005)
    r = [box("Register_Base", 0.9, 1.4, 3.85, 4.25, 1.10, 1.2, M["charcoal"], X),
         box("Register_Screen", 0.95, 1.35, 4.15, 4.2, 1.2, 1.5, M["charcoal"], X),
         box("Register_Display", 0.97, 1.33, 4.12, 4.15, 1.25, 1.45, M["glow"], X)]
    group("INTERACT_Register", r, X)
    t = [box("TEL_Base", -1.45, -1.05, 3.95, 4.35, 1.10, 1.22, M["charcoal"], X),
         box("TEL_HandsetBar", -1.43, -1.07, 4.10, 4.20, 1.22, 1.28, M["charcoal"], X),
         cyl("TEL_Ear", 0.05, 0.06, (-1.43, 4.15, 1.29), M["charcoal"], X),
         cyl("TEL_Mouth", 0.05, 0.06, (-1.07, 4.15, 1.29), M["charcoal"], X),
         cyl("TEL_Dial", 0.07, 0.02, (-1.25, 3.94, 1.17), M["copper"], X, rot=(math.pi/2, 0, 0))]
    group("INTERACT_Telephone", t, X)
    d = [box("Display_Base", -0.45, 0.55, 3.7, 4.4, 1.10, 1.15, M["steel"], X),
         box("Display_Glass", -0.45, 0.55, 3.7, 4.4, 1.15, 1.55, M["glass"], X)]
    for k in range(6):
        d.append(sphere(f"Pastry_{k}", 0.07, (-0.3 + (k % 3) * 0.3, 3.95 + (k // 3) * 0.3, 1.2), (1, 1, 0.6), M["pastry"], X))
    group("INTERACT_MenuDisplay", d, X)
    # --- seating: banquette tables, marble tables, communal high table + stools, olive tree
    for i, cy in enumerate((1.4, 2.7)):
        cx = -2.75
        box(f"BTable_Top_{i}", cx-0.4, cx+0.4, cy-0.5, cy+0.5, 0.72, 0.76, M["oak"], F)
        for lx in (-0.35, 0.35):
            for ly in (-0.45, 0.45):
                box(f"BTable_Leg_{i}_{lx}_{ly}", cx+lx-0.02, cx+lx+0.02, cy+ly-0.02, cy+ly+0.02, 0, 0.72, M["charcoal"], F)
        chair(f"BChair_{i}", cx + 0.8, cy, 1, M["rattan"], M["charcoal"], F)
    for i, (x, y) in enumerate(((-1.0, 2.2), (0.9, 2.4))):
        cyl(f"MTable_Top_{i}", 0.45, 0.04, (x, y, 0.75), M["marble"], F)
        cyl(f"MTable_Leg_{i}", 0.04, 0.75, (x, y, 0.375), M["charcoal"], F, verts=12)
        cyl(f"MTable_Base_{i}", 0.22, 0.03, (x, y, 0.015), M["charcoal"], F)
        chair(f"MChair_{i}a", x - 0.65, y, -1, M["cream"], M["charcoal"], F)
        chair(f"MChair_{i}b", x + 0.65, y, 1, M["cream"], M["charcoal"], F)
    box("Communal_Table", 1.6, 2.5, 1.2, 3.2, 0, 1.05, M["oak"], F)
    for k, y in enumerate((1.5, 2.2, 2.9)):
        cyl(f"Stool_Seat_{k}", 0.17, 0.05, (2.85, y, 0.72), M["leather"], F)
        cyl(f"Stool_Leg_{k}", 0.03, 0.7, (2.85, y, 0.35), M["charcoal"], F, verts=8)
    cyl("Tree_Pot", 0.25, 0.4, (3.1, 0.9, 0.2), M["charcoal"], F)
    cyl("Tree_Trunk", 0.05, 1.5, (3.1, 0.9, 1.1), M["wood_dark"], F, verts=8)
    for k, (dx, dy, z, s) in enumerate(((0, 0, 2.1, 0.55), (0.3, 0.1, 1.7, 0.4), (-0.3, -0.1, 1.8, 0.42))):
        sphere(f"Tree_Leaves_{k}", s, (3.1 + dx, 0.9 + dy, z), (1, 1, 0.9), M["plant"], F)
    print("stage3 ok")


# ================================================================ stage 4
def stage4_lights_camera():
    L, K = C["Lighting"], C["Camera"]
    drums = [(-2.75, 1.4), (-2.75, 2.7), (-1.0, 2.2), (0.9, 2.4)]
    globes = [(2.05, 2.2), (-0.6, 3.9), (0.6, 3.9)]
    for i, (x, y) in enumerate(drums):
        zl, zr = 2.45, roof_z(x)
        cyl(f"Pendant_Cord_D{i}", 0.006, zr - zl, (x, y, (zl + zr) / 2), M["charcoal"], L, verts=6)
        cyl(f"Pendant_Drum_{i}", 0.22, 0.26, (x, y, zl), M["rattan"], L)
        point_light(f"Light_Drum_{i}", (x, y, zl - 0.05), 45, L)
    for i, (x, y) in enumerate(globes):
        zl, zr = 2.3, roof_z(x)
        cyl(f"Pendant_Cord_G{i}", 0.006, zr - zl, (x, y, (zl + zr) / 2), M["charcoal"], L, verts=6)
        sphere(f"Pendant_Globe_{i}", 0.16, (x, y, zl), (1, 1, 1), M["glow"], L)
        point_light(f"Light_Globe_{i}", (x, y, zl - 0.05), 40, L)
    # square LED strip hanging over the counter
    z = 2.55
    for nm, a, b, c, d in (("N", -1.6, 1.6, 3.1, 3.14), ("S", -1.6, 1.6, 4.66, 4.7), ("W", -1.6, -1.56, 3.1, 4.7), ("E", 1.56, 1.6, 3.1, 4.7)):
        box(f"Strip_{nm}", a, b, c, d, z, z + 0.04, M["strip"], L)
    for k, (x, y) in enumerate(((-1.6, 3.1), (1.6, 3.1), (-1.6, 4.7), (1.6, 4.7))):
        zr = roof_z(x)
        cyl(f"Strip_Cord_{k}", 0.005, zr - z, (x, y, (z + zr) / 2), M["charcoal"], L, verts=6)
    point_light("Light_Strip_A", (0, 3.6, 2.4), 60, L, (1.0, 0.9, 0.8))
    point_light("Light_Strip_B", (0, 4.3, 2.4), 60, L, (1.0, 0.9, 0.8))
    point_light("Light_Window_Fill", (0, 1.2, 2.8), 80, L, (1.0, 0.85, 0.65))
    point_light("Light_Facade", (0, -3.0, 2.2), 200, L, (1.0, 0.8, 0.55))
    point_light("Light_Mezzanine", (0, 5.4, 2.4), 40, L)
    sun = bpy.data.lights.new("Light_Street_Sun", 'SUN'); sun.energy = 2.5; sun.color = (1.0, 0.97, 0.92)
    so = bpy.data.objects.new("Light_Street_Sun", sun); so.rotation_euler = (math.radians(65), 0, math.radians(15)); L.objects.link(so)
    w = bpy.context.scene.world or bpy.data.worlds.new("World"); bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.66, 0.72, 1); bg.inputs[1].default_value = 1.2   # overcast day, as in the photos
    cd = bpy.data.cameras.new("Cam_Intro"); cd.lens = 18
    cam = bpy.data.objects.new("Cam_Intro", cd); K.objects.link(cam)
    bpy.context.scene.camera = cam
    for f, p, t in CAMERA_KEYS:
        cam.location = p
        cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end, sc.render.fps = 1, CAMERA_KEYS[-1][0], 30
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    print("stage4 ok")


# ================================================================ stage 5
def write_camera_json():
    import json
    g = lambda p: [round(p[0], 3), round(p[2], 3), round(-p[1], 3)]
    data = [{"frame": f, "position": g(p), "target": g(t)} for f, p, t in CAMERA_KEYS]
    with open(os.path.join(OUT_DIR, "camera_path.json"), "w") as fh:
        json.dump({"fps": 30, "introEndFrame": 180, "keys": data}, fh, indent=2)


def stage5_export(render=True):
    os.makedirs(OUT_DIR, exist_ok=True)
    write_camera_json()
    sc = bpy.context.scene
    sc.frame_set(1)
    # Open the saved project in the animated camera view so the cafe is immediately visible.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != 'VIEW_3D':
                continue
            space = area.spaces.active
            space.camera = sc.camera
            space.region_3d.view_perspective = 'CAMERA'
            space.region_3d.view_camera_zoom = 0
            space.clip_start = 0.05
            space.clip_end = 250
            space.shading.type = 'MATERIAL'
            space.overlay.show_overlays = False
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "brew-cup-cafe.blend"))
    if render:
        # CPU Cycles also works in headless Blender builds without an available GPU.
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = 16
        sc.frame_set(180)
        sc.render.filepath = os.path.join(OUT_DIR, "backup_render.png")
        bpy.ops.render.render(write_still=True)
    sc.frame_set(1)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, "brew-cup-cafe.glb"), export_format='GLB',
        export_cameras=True, export_lights=True, export_animations=True,
        export_apply=True, export_yup=True)
    print("stage5 ok ->", OUT_DIR)


def run_all():
    stage1_setup(); stage2_exterior(); stage3_interior(); stage4_lights_camera(); stage5_export()


if __name__ == "__main__":
    run_all()
