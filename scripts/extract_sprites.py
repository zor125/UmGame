"""Deterministically extract transparent 48x48 game sprites from the source sheet."""
from collections import deque
from pathlib import Path
from PIL import Image

SOURCE = Path("assets-source/um-sprite-sheet.png")
PLAYER_OUT = Path("public/sprites/player")
OBSTACLE_OUT = Path("public/sprites/obstacles")

# Panel interiors measured from the one-pixel panel borders in the 1536x1024 source.
PANELS = {
    "player/run-1.png": (33, 167, 215, 362),
    "player/run-2.png": (240, 167, 434, 362),
    "player/jump.png": (459, 167, 641, 362),
    "player/long-jump.png": (666, 167, 854, 362),
    "player/slide-1.png": (876, 167, 1066, 362),
    "player/slide-2.png": (1091, 167, 1285, 362),
    "player/dead.png": (1311, 167, 1503, 362),
    "obstacles/rock-small.png": (33, 552, 228, 752),
    "obstacles/rock-wide.png": (260, 552, 493, 752),
    "obstacles/cactus.png": (528, 552, 726, 752),
    "obstacles/bird.png": (760, 552, 970, 752),
    "obstacles/platform.png": (998, 552, 1247, 752),
    "obstacles/block.png": (1280, 552, 1503, 752),
}


PLAYER_GROUND_ANCHOR_Y = 46


def foreground_with_enclosed_details(panel: Image.Image, keep_multiple: bool) -> Image.Image:
    """Remove the baked checkerboard while retaining enclosed white eyes/details."""
    rgb = panel.convert("RGB")
    width, height = rgb.size
    candidates = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            r, g, b = rgb.getpixel((x, y))
            candidates[y][x] = (r + g + b) / 3 < 150

    # The baked checkerboard contains compression/shading noise. Keep the actual
    # sprite components, not every isolated dark pixel in the panel.
    seen = set()
    components = []
    for y in range(height):
        for x in range(width):
            if not candidates[y][x] or (x, y) in seen:
                continue
            component = []
            component_queue = [(x, y)]
            seen.add((x, y))
            while component_queue:
                px, py = component_queue.pop()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and candidates[ny][nx] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        component_queue.append((nx, ny))
            components.append(component)
    components.sort(key=len, reverse=True)
    if not components:
        raise ValueError("No sprite component detected")
    minimum_size = max(40, round(len(components[0]) * 0.03)) if keep_multiple else len(components[0])
    selected = [component for component in components if len(component) >= minimum_size]
    dark = [[False] * width for _ in range(height)]
    for component in selected:
        for x, y in component:
            dark[y][x] = True

    outside = [[False] * width for _ in range(height)]
    queue = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or outside[y][x] or dark[y][x]:
            continue
        outside[y][x] = True
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    rgba = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    for y in range(height):
        for x in range(width):
            if dark[y][x] or not outside[y][x]:
                r, g, b = rgb.getpixel((x, y))
                rgba.putpixel((x, y), (r, g, b, 255))
    return rgba


def tight_crop(sprite: Image.Image) -> Image.Image:
    alpha_bbox = sprite.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError("No sprite pixels detected")
    return sprite.crop(alpha_bbox)


def normalize_obstacle(sprite: Image.Image) -> Image.Image:
    sprite = tight_crop(sprite)
    width, height = sprite.size
    scale = min(48 / width, 48 / height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    sprite = sprite.resize(size, Image.Resampling.NEAREST)
    output = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    output.alpha_composite(sprite, ((48 - size[0]) // 2, 48 - size[1]))
    return output


def normalize_players(sprites: dict[str, Image.Image]) -> dict[str, Image.Image]:
    tight = {name: tight_crop(sprite) for name, sprite in sprites.items()}
    max_width = max(sprite.width for sprite in tight.values())
    max_height = max(sprite.height for sprite in tight.values())
    player_scale = min(46 / max_width, PLAYER_GROUND_ANCHOR_Y / max_height)
    print(f"PLAYER_SCALE={player_scale:.6f}, groundAnchorY={PLAYER_GROUND_ANCHOR_Y}")
    outputs = {}
    for name, sprite in tight.items():
        size = (max(1, round(sprite.width * player_scale)), max(1, round(sprite.height * player_scale)))
        resized = sprite.resize(size, Image.Resampling.NEAREST)
        output = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        output.alpha_composite(resized, ((48 - size[0]) // 2, PLAYER_GROUND_ANCHOR_Y - size[1]))
        outputs[name] = output
    return outputs


def create_preview(players: dict[str, Image.Image]) -> None:
    preview = Image.new("RGBA", (6 * 56 + 8, 64), (247, 247, 247, 255))
    order = ["run-1.png", "run-2.png"] * 3
    for index, name in enumerate(order):
        preview.alpha_composite(players[name], (8 + index * 56, 8))
    for x in range(preview.width):
        preview.putpixel((x, 8 + PLAYER_GROUND_ANCHOR_Y), (80, 80, 80, 255))
    Path("debug").mkdir(exist_ok=True)
    preview.convert("RGB").save("debug/player-sprite-preview.png")


def main() -> None:
    source = Image.open(SOURCE)
    if source.mode != "RGB" or source.size != (1536, 1024):
        raise ValueError(f"Unexpected source: mode={source.mode}, size={source.size}")
    PLAYER_OUT.mkdir(parents=True, exist_ok=True)
    OBSTACLE_OUT.mkdir(parents=True, exist_ok=True)
    extracted = {
        relative_path: foreground_with_enclosed_details(source.crop(panel_box), relative_path.startswith("obstacles/"))
        for relative_path, panel_box in PANELS.items()
    }
    player_sprites = normalize_players({Path(path).name: image for path, image in extracted.items() if path.startswith("player/")})
    create_preview(player_sprites)
    for relative_path in PANELS:
        output = player_sprites[Path(relative_path).name] if relative_path.startswith("player/") else normalize_obstacle(extracted[relative_path])
        destination = Path("public/sprites") / relative_path
        output.save(destination, "PNG", optimize=True)
        alpha = output.getchannel("A")
        print(f"{destination}: {output.size[0]}x{output.size[1]} {output.mode}, alpha={alpha.getextrema()}")


if __name__ == "__main__":
    main()
