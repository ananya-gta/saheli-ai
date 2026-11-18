"""Build the five demo websites with REAL photos (no Claude credits used).

    cd backend && python -m app.demo_sites you@example.com

Then open http://localhost:8000/sites/demo-bakery/ (and demo-homefood, demo-boutique,
demo-beauty, demo-education) while the API server is running.
"""
import sys

from . import auth, config, images, sitegen, sitestore, storefront
from .demo_samples import SAMPLES


def main(owner_email: str | None = None, only: list[str] | None = None) -> None:
    owner = auth.get_or_create_user(owner_email) if owner_email else None
    print("Photo sources:", ", ".join(images.provider_names()))
    for key, (content, profile) in SAMPLES.items():
        if only and key not in only:
            continue
        slug = f"demo-{key}"
        with sitestore.creating(slug, replace=True) as draft:
            found = sitegen.fetch_images(content, content["archetype"], draft.folder)
            (draft.folder / "index.html").write_text(sitegen.render_site(content, profile, slug, found), encoding="utf-8")
            draft.data = {"content": content, "profile": profile, "images": found}
        storefront.write_files(slug)
        if owner:
            auth.assign_site(slug, owner["id"])
        photos = len({p["src"] for v in found.values() for p in v})
        empty = [k for k, v in found.items() if not v]
        status = "OK" if photos and not empty else "CHECK INTERNET CONNECTION"
        print(f"  {slug:16s} {photos:2d} photos  {status}  ->  {config.site_url(slug)}")


if __name__ == "__main__":
    # python -m app.demo_sites you@example.com   -> the demo sites appear in that user's dashboard
    main(sys.argv[1] if len(sys.argv) > 1 else None)
