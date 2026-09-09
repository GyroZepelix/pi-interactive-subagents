#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "PyYAML>=6.0,<7",
# ]
# ///
"""Manage the planning phases of repository-local spec work items."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path
from typing import Any

import yaml

SCHEMA_VERSION = 1
ROUTES = {"quick-plan", "grill-to-spec"}
KINDS = {"initiative", "work-item"}
WORK_TYPES = {
    "feature",
    "bug",
    "refactor",
    "research",
    "migration",
    "operations",
    "documentation",
    "other",
}
STATUSES = {"discovering", "ready_for_spec", "planned"}
TRANSITIONS = {
    "discovering": {"ready_for_spec"},
    "ready_for_spec": {"planned"},
    "planned": set(),
}
ACTIVE_START = "<!-- spec-items:active:start -->"
ACTIVE_END = "<!-- spec-items:active:end -->"
ARCHIVE_START = "<!-- spec-items:archive:start -->"
ARCHIVE_END = "<!-- spec-items:archive:end -->"
ID_PATTERN = re.compile(r"^[0-9]{6}-[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*(?:-[0-9]+)?$")


class ProtocolError(Exception):
    """A user-correctable protocol error with a stable process exit code."""

    def __init__(self, message: str, code: int = 5) -> None:
        super().__init__(message)
        self.code = code


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=True, sort_keys=True))


def now_iso() -> str:
    return dt.datetime.now().astimezone().replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug[:80] or "work-item"


def protocol_paths(root: Path) -> dict[str, Path]:
    spec = root / "spec"
    return {
        "root": root,
        "spec": spec,
        "active": spec / "active",
        "archive": spec / "archive",
        "templates": spec / "templates",
        "index": spec / "index.md",
    }


def require_protocol(paths: dict[str, Path]) -> None:
    required_files = [
        paths["spec"] / "AGENTS.md",
        paths["templates"] / "item.yaml",
        paths["templates"] / "discovery.md",
        paths["templates"] / "plan.md",
        paths["templates"] / "verification.md",
        paths["templates"] / "outcome.md",
        paths["index"],
    ]
    required_directories = [paths["active"], paths["archive"]]
    invalid = [path for path in required_files if not path.is_file()]
    invalid.extend(path for path in required_directories if not path.is_dir())
    if invalid:
        relative = sorted(str(path.relative_to(paths["root"])) for path in invalid)
        raise ProtocolError(
            "required spec protocol paths are missing or have the wrong type: "
            + ", ".join(relative),
            code=3,
        )


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent), text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def load_manifest(item_dir: Path) -> dict[str, Any]:
    manifest_path = item_dir / "item.yaml"
    if not manifest_path.is_file():
        raise ProtocolError(f"item manifest not found: {manifest_path}", code=3)
    try:
        data = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise ProtocolError(f"cannot read {manifest_path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ProtocolError(f"manifest must contain a YAML mapping: {manifest_path}")
    return data


def write_manifest(item_dir: Path, manifest: dict[str, Any]) -> None:
    content = yaml.safe_dump(
        manifest,
        allow_unicode=False,
        default_flow_style=False,
        sort_keys=False,
    )
    atomic_write(item_dir / "item.yaml", content)


def validate_manifest_shape(item_dir: Path, manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = {
        "schema_version",
        "id",
        "title",
        "kind",
        "work_type",
        "parent",
        "route",
        "status",
        "created_at",
        "updated_at",
        "external_refs",
        "wiki_refs",
    }
    missing = sorted(required - manifest.keys())
    if missing:
        errors.append("missing fields: " + ", ".join(missing))

    item_id = manifest.get("id")
    if item_id != item_dir.name:
        errors.append(f"manifest id {item_id!r} does not match directory {item_dir.name!r}")
    if not isinstance(item_id, str) or not ID_PATTERN.fullmatch(item_id):
        errors.append("id must match YYMMDD-HHMM-kebab-slug")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must equal {SCHEMA_VERSION}")
    if not isinstance(manifest.get("title"), str) or not manifest.get("title", "").strip():
        errors.append("title must be a non-empty string")
    if manifest.get("kind") not in KINDS:
        errors.append("kind must be one of: " + ", ".join(sorted(KINDS)))
    work_type = manifest.get("work_type")
    if manifest.get("kind") == "work-item" and work_type not in WORK_TYPES:
        errors.append("work_type must be one of: " + ", ".join(sorted(WORK_TYPES)))
    if manifest.get("kind") == "initiative" and work_type not in {None, "other"}:
        errors.append("initiative work_type must be null or other")
    parent = manifest.get("parent")
    if parent is not None and (not isinstance(parent, str) or not parent.strip()):
        errors.append("parent must be null or a non-empty item ID")
    if parent == item_id:
        errors.append("an item cannot be its own parent")
    route = manifest.get("route")
    status = manifest.get("status")
    if route not in ROUTES:
        errors.append("route must be one of: " + ", ".join(sorted(ROUTES)))
    if status not in STATUSES:
        errors.append("status must be one of: " + ", ".join(sorted(STATUSES)))
    if route == "quick-plan" and status != "planned":
        errors.append("quick-plan items must have status planned")
    if route == "grill-to-spec" and status not in {"discovering", "ready_for_spec", "planned"}:
        errors.append("grill-to-spec items must use a current planning status")
    for field in ("created_at", "updated_at"):
        value = manifest.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{field} must be a non-empty ISO 8601 string")
            continue
        try:
            parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            errors.append(f"{field} must be a parseable ISO 8601 timestamp")
            continue
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            errors.append(f"{field} must include a timezone offset")
    external_refs = manifest.get("external_refs")
    if not isinstance(external_refs, list):
        errors.append("external_refs must be a list")
    else:
        required_ref_fields = {"system", "type", "key"}
        allowed_ref_fields = required_ref_fields | {"url"}
        for index, reference in enumerate(external_refs):
            if not isinstance(reference, dict):
                errors.append(f"external_refs[{index}] must be a mapping")
                continue
            missing_ref_fields = sorted(required_ref_fields - reference.keys())
            unknown_ref_fields = sorted(
                str(field) for field in reference.keys() if field not in allowed_ref_fields
            )
            if missing_ref_fields:
                errors.append(
                    f"external_refs[{index}] missing fields: {', '.join(missing_ref_fields)}"
                )
            if unknown_ref_fields:
                errors.append(
                    f"external_refs[{index}] has unknown fields: {', '.join(unknown_ref_fields)}"
                )
            for field in required_ref_fields:
                if field in reference and (
                    not isinstance(reference[field], str) or not reference[field].strip()
                ):
                    errors.append(f"external_refs[{index}].{field} must be a non-empty string")
            if "url" in reference and (
                not isinstance(reference["url"], str) or not reference["url"].strip()
            ):
                errors.append(f"external_refs[{index}].url must be a non-empty string")
    if not isinstance(manifest.get("wiki_refs"), list) or not all(
        isinstance(value, str) and value.strip() for value in manifest.get("wiki_refs", [])
    ):
        errors.append("wiki_refs must be a list of non-empty strings")
    return errors


def validate_item(item_dir: Path, paths: dict[str, Path]) -> dict[str, Any]:
    manifest = load_manifest(item_dir)
    errors = validate_manifest_shape(item_dir, manifest)
    route = manifest.get("route")
    status = manifest.get("status")
    if route == "quick-plan" and not (item_dir / "plan.md").is_file():
        errors.append("quick-plan items require plan.md")
    if route == "grill-to-spec" and not (item_dir / "discovery.md").is_file():
        errors.append("grill-to-spec items require discovery.md")
    if route == "grill-to-spec" and status == "planned" and not (item_dir / "plan.md").is_file():
        errors.append("planned grill-to-spec items require plan.md")

    parent = manifest.get("parent")
    if parent:
        parent_paths = [paths["active"] / parent, paths["archive"] / parent]
        if not any((path / "item.yaml").is_file() for path in parent_paths):
            errors.append(f"parent item does not exist: {parent}")

    if errors:
        raise ProtocolError(f"invalid item {item_dir.name}: " + "; ".join(errors))
    return manifest


def render_template(template_path: Path, values: dict[str, str]) -> str:
    content = template_path.read_text(encoding="utf-8")
    for key, value in values.items():
        content = content.replace("{{" + key + "}}", value)
    return content


def parse_external_ref(value: str) -> dict[str, str]:
    parts = value.split(":", 3)
    if len(parts) < 3 or not all(part.strip() for part in parts[:3]):
        raise argparse.ArgumentTypeError(
            "external refs use SYSTEM:TYPE:KEY or SYSTEM:TYPE:KEY:URL"
        )
    result = {"system": parts[0], "type": parts[1], "key": parts[2]}
    if len(parts) == 4 and parts[3]:
        result["url"] = parts[3]
    return result


def item_id_exists(paths: dict[str, Path], candidate: str) -> bool:
    return any((paths[location] / candidate).exists() for location in ("active", "archive"))


def unique_item_id(paths: dict[str, Path], title: str, requested: str | None) -> str:
    if requested:
        candidate = requested
        if not ID_PATTERN.fullmatch(candidate):
            raise ProtocolError("--id must match YYMMDD-HHMM-kebab-slug")
        if item_id_exists(paths, candidate):
            raise ProtocolError(f"work item already exists: {candidate}")
        return candidate

    prefix = dt.datetime.now().strftime("%y%m%d-%H%M")
    base = f"{prefix}-{slugify(title)}"
    candidate = base
    suffix = 2
    while item_id_exists(paths, candidate):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def replace_region(text: str, start: str, end: str, body: str) -> str:
    if text.count(start) != 1 or text.count(end) != 1:
        raise ProtocolError(f"spec/index.md must contain exactly one {start!r} and {end!r}")
    start_index = text.index(start) + len(start)
    end_index = text.index(end)
    if start_index > end_index:
        raise ProtocolError(f"managed index markers are out of order: {start!r}")
    return text[:start_index] + "\n" + body.rstrip() + "\n" + text[end_index:]


def table_for(items: list[tuple[Path, dict[str, Any]]], location: str) -> str:
    lines = [
        "| Item | Kind | Status | Updated |",
        "| --- | --- | --- | --- |",
    ]
    for item_dir, manifest in sorted(items, key=lambda entry: entry[0].name):
        target = "plan.md" if (item_dir / "plan.md").is_file() else "discovery.md"
        title = str(manifest["title"]).replace("|", "\\|")
        updated = str(manifest["updated_at"]).split("T", 1)[0]
        lines.append(
            f"| [{title}](./{location}/{item_dir.name}/{target}) | "
            f"{manifest['kind']} | {manifest['status']} | {updated} |"
        )
    return "\n".join(lines)


def collect_items(
    directory: Path,
    paths: dict[str, Path],
    require_manifests: bool = False,
) -> list[tuple[Path, dict[str, Any]]]:
    items: list[tuple[Path, dict[str, Any]]] = []
    if not directory.is_dir():
        return items
    item_dirs = sorted(
        path for path in directory.iterdir() if path.is_dir() and not path.name.startswith(".")
    )
    for item_dir in item_dirs:
        if not (item_dir / "item.yaml").is_file():
            if require_manifests:
                raise ProtocolError(f"active item manifest not found: {item_dir / 'item.yaml'}", code=3)
            continue
        items.append((item_dir, validate_item(item_dir, paths)))
    return items


def update_index(paths: dict[str, Path]) -> None:
    text = paths["index"].read_text(encoding="utf-8")
    active_body = table_for(
        collect_items(paths["active"], paths, require_manifests=True),
        "active",
    )
    archive_body = table_for(collect_items(paths["archive"], paths), "archive")
    text = replace_region(text, ACTIVE_START, ACTIVE_END, active_body)
    text = replace_region(text, ARCHIVE_START, ARCHIVE_END, archive_body)
    atomic_write(paths["index"], text)


def item_from_explicit(value: str, paths: dict[str, Path]) -> Path:
    raw = Path(value).expanduser()
    candidates: list[Path] = []
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.extend([paths["root"] / raw, paths["active"] / value])
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_file():
            resolved = resolved.parent
        if resolved.is_dir() and (resolved / "item.yaml").is_file():
            try:
                resolved.relative_to(paths["active"].resolve())
            except ValueError as exc:
                raise ProtocolError("only active work items can be resolved by this helper") from exc
            return resolved
    raise ProtocolError(f"active work item not found: {value}", code=3)


def resolve_item(
    paths: dict[str, Path],
    explicit: str | None,
    statuses: set[str],
    routes: set[str],
) -> tuple[Path, dict[str, Any]]:
    if explicit:
        item_dir = item_from_explicit(explicit, paths)
        manifest = validate_item(item_dir, paths)
        if statuses and manifest["status"] not in statuses:
            raise ProtocolError(
                f"item {manifest['id']} has status {manifest['status']!r}; expected one of {sorted(statuses)}"
            )
        if routes and manifest["route"] not in routes:
            raise ProtocolError(
                f"item {manifest['id']} has route {manifest['route']!r}; expected one of {sorted(routes)}"
            )
        return item_dir, manifest

    matches: list[tuple[Path, dict[str, Any]]] = []
    for item_dir, manifest in collect_items(
        paths["active"], paths, require_manifests=True
    ):
        if statuses and manifest["status"] not in statuses:
            continue
        if routes and manifest["route"] not in routes:
            continue
        matches.append((item_dir, manifest))
    if not matches:
        raise ProtocolError("no eligible active work item found", code=3)
    if len(matches) > 1:
        ids = ", ".join(manifest["id"] for _, manifest in matches)
        raise ProtocolError(f"multiple eligible active work items found; specify one: {ids}", code=4)
    return matches[0]


def command_create(args: argparse.Namespace, paths: dict[str, Path]) -> None:
    item_id = unique_item_id(paths, args.title, args.id)
    item_dir = paths["active"] / item_id
    item_dir.mkdir(parents=False, exist_ok=False)
    created = now_iso()
    status = "planned" if args.route == "quick-plan" else "discovering"
    manifest: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "id": item_id,
        "title": args.title.strip(),
        "kind": args.kind,
        "work_type": None if args.kind == "initiative" else args.work_type,
        "parent": args.parent,
        "route": args.route,
        "status": status,
        "created_at": created,
        "updated_at": created,
        "external_refs": args.external_ref,
        "wiki_refs": args.wiki_ref,
    }
    try:
        write_manifest(item_dir, manifest)
        values = {
            "ID": item_id,
            "TITLE": args.title.strip(),
            "DATE": created.split("T", 1)[0],
            "CREATED_AT": created,
            "UPDATED_AT": created,
        }
        template_name = "plan.md" if args.route == "quick-plan" else "discovery.md"
        content = render_template(paths["templates"] / template_name, values)
        atomic_write(item_dir / template_name, content)
        validate_item(item_dir, paths)
        update_index(paths)
    except Exception:
        for child in item_dir.iterdir():
            child.unlink()
        item_dir.rmdir()
        raise
    emit(
        {
            "action": "create",
            "id": item_id,
            "path": str(item_dir.relative_to(paths["root"])),
            "status": status,
        }
    )


def parse_csv_set(value: str | None, allowed: set[str], label: str) -> set[str]:
    if not value:
        return set()
    result = {part.strip() for part in value.split(",") if part.strip()}
    invalid = sorted(result - allowed)
    if invalid:
        raise ProtocolError(f"invalid {label}: {', '.join(invalid)}")
    return result


def command_resolve(args: argparse.Namespace, paths: dict[str, Path]) -> None:
    statuses = parse_csv_set(args.status, STATUSES, "statuses")
    routes = parse_csv_set(args.route, ROUTES, "routes")
    item_dir, manifest = resolve_item(paths, args.item, statuses, routes)
    emit(
        {
            "action": "resolve",
            "id": manifest["id"],
            "path": str(item_dir.relative_to(paths["root"])),
            "route": manifest["route"],
            "status": manifest["status"],
        }
    )


def command_transition(args: argparse.Namespace, paths: dict[str, Path]) -> None:
    item_dir, manifest = resolve_item(paths, args.item, set(), set())
    original = dict(manifest)
    source = manifest["status"]
    target = args.to
    if target not in TRANSITIONS.get(source, set()):
        raise ProtocolError(f"invalid transition: {source} -> {target}")
    if target == "ready_for_spec" and not (item_dir / "discovery.md").is_file():
        raise ProtocolError("ready_for_spec requires discovery.md")
    if target == "planned" and not (item_dir / "plan.md").is_file():
        raise ProtocolError("planned requires plan.md")
    manifest["status"] = target
    manifest["updated_at"] = now_iso()
    write_manifest(item_dir, manifest)
    try:
        validate_item(item_dir, paths)
        update_index(paths)
    except Exception:
        write_manifest(item_dir, original)
        raise
    emit({"action": "transition", "id": manifest["id"], "from": source, "to": target})


def command_validate(args: argparse.Namespace, paths: dict[str, Path]) -> None:
    if args.all:
        items = collect_items(paths["active"], paths, require_manifests=True)
        update_index(paths)
        emit({"action": "validate", "count": len(items), "valid": True})
        return
    if not args.item:
        raise ProtocolError("validate requires --item or --all", code=2)
    item_dir, manifest = resolve_item(paths, args.item, set(), set())
    validate_item(item_dir, paths)
    emit({"action": "validate", "id": manifest["id"], "valid": True})


def command_index(paths: dict[str, Path]) -> None:
    update_index(paths)
    emit({"action": "index", "path": str(paths["index"].relative_to(paths["root"]))})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create, resolve, transition, validate, and index planning work items."
    )
    parser.add_argument("--root", default=".", help="Repository root, default: current directory")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="Create a non-overwriting active work item")
    create.add_argument("--title", required=True)
    create.add_argument("--id", help="Explicit YYMMDD-HHMM-kebab-slug ID")
    create.add_argument("--route", choices=sorted(ROUTES), required=True)
    create.add_argument("--kind", choices=sorted(KINDS), default="work-item")
    create.add_argument("--work-type", choices=sorted(WORK_TYPES), default="other")
    create.add_argument("--parent")
    create.add_argument("--external-ref", action="append", default=[], type=parse_external_ref)
    create.add_argument("--wiki-ref", action="append", default=[])

    resolve = subparsers.add_parser("resolve", help="Resolve one eligible active work item")
    resolve.add_argument("--item", help="Explicit item ID, directory, or artifact path")
    resolve.add_argument("--status", help="Comma-separated eligible statuses")
    resolve.add_argument("--route", help="Comma-separated eligible routes")

    transition = subparsers.add_parser("transition", help="Apply a current planning transition")
    transition.add_argument("--item", help="Explicit item ID, directory, or artifact path")
    transition.add_argument("--to", choices=sorted(STATUSES), required=True)

    validate = subparsers.add_parser("validate", help="Validate one item or all active items")
    validate.add_argument("--item", help="Explicit item ID, directory, or artifact path")
    validate.add_argument("--all", action="store_true")

    subparsers.add_parser("index", help="Regenerate managed spec index tables")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: repository root is not a directory: {root}", file=sys.stderr)
        return 2
    paths = protocol_paths(root)
    try:
        require_protocol(paths)
        if args.command == "create":
            command_create(args, paths)
        elif args.command == "resolve":
            command_resolve(args, paths)
        elif args.command == "transition":
            command_transition(args, paths)
        elif args.command == "validate":
            command_validate(args, paths)
        elif args.command == "index":
            command_index(paths)
        else:
            parser.error(f"unknown command: {args.command}")
    except ProtocolError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return exc.code
    except (OSError, yaml.YAMLError) as exc:
        print(f"ERROR: filesystem or YAML operation failed: {exc}", file=sys.stderr)
        return 6
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
