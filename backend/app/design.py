"""Design system for generated websites.

Each ARCHETYPE is a distinct visual identity with its own layout template,
typography, palettes and vocabulary. Line icons only (no emoji), restrained
colour, real photography (see images.py).
"""

GF = "https://fonts.googleapis.com/css2?display=swap&family="

ARCHETYPES = {
    "bakery": {
        "layout": "food.html", "variant": "bakery",
        "for": "home bakery, cakes, cookies, desserts, sweets, cafe",
        "fonts": GF + "Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Jost:wght@400;500;600&family=Noto+Serif+Devanagari:wght@500;600;700",
        "font": {"head": "'Cormorant Garamond',Georgia,serif", "body": "'Jost',system-ui,sans-serif", "hindi": "'Noto Serif Devanagari',serif"},
        "palettes": {
            "caramel":   {"bg": "#FBF6EF", "alt": "#F3E8DA", "ink": "#2B1D14", "muted": "#7A6656", "line": "#E7D9C6", "primary": "#6B3F24", "primary_ink": "#FFF9F1", "accent": "#C8955C"},
            "pistachio": {"bg": "#FAF8F1", "alt": "#EEF0E2", "ink": "#232619", "muted": "#6A6F5A", "line": "#E1E3D0", "primary": "#4E6233", "primary_ink": "#FFFFFF", "accent": "#C79A63"},
            "rosewater": {"bg": "#FCF7F5", "alt": "#F5E8E4", "ink": "#2C1D1D", "muted": "#7B6461", "line": "#ECDAD5", "primary": "#8A3F4E", "primary_ink": "#FFFFFF", "accent": "#D1A46B"},
        },
        "labels": {"shop": "Menu", "cta": "Order now", "shop_eyebrow": "Baked fresh, to order", "gallery": "From our oven",
                   "how": "How ordering works", "contact": "Custom orders & enquiries", "story": "Our story"},
        "hero": "landscape",
    },
    "homefood": {
        "layout": "homefood.html", "variant": "homefood",
        "for": "pickles/achaar, papad, masala, tiffin, home-cooked meals, catering, snacks",
        "fonts": GF + "Rozha+One&family=Instrument+Sans:wght@400;500;600&family=Tiro+Devanagari+Hindi&family=Caveat:wght@500",
        "font": {"head": "'Rozha One',Georgia,serif", "body": "'Instrument Sans',system-ui,sans-serif", "hindi": "'Tiro Devanagari Hindi',serif"},
        "palettes": {
            "terracotta": {"bg": "#F8F2E8", "alt": "#EFE4D2", "ink": "#24190F", "muted": "#74624F", "line": "#E2D4BE", "primary": "#9E3B1B", "primary_ink": "#FFF8EE", "accent": "#D9A441"},
            "turmeric":   {"bg": "#FAF5E9", "alt": "#F2E8CF", "ink": "#221B0D", "muted": "#736650", "line": "#E5D8B8", "primary": "#B5651D", "primary_ink": "#FFFFFF", "accent": "#3F5B3A"},
            "curryleaf":  {"bg": "#F6F4EA", "alt": "#E9E7D5", "ink": "#1B2014", "muted": "#626851", "line": "#DADBC2", "primary": "#3F5B2A", "primary_ink": "#FFFFFF", "accent": "#C9792E"},
        },
        "labels": {"shop": "Products", "cta": "Order now", "shop_eyebrow": "Small batch · Homemade", "gallery": "From our kitchen",
                   "how": "How ordering works", "contact": "Bulk & gifting enquiries", "story": "Our story"},
        "hero": "portrait",
    },
    "boutique": {
        "layout": "fashion.html", "variant": "boutique",
        "for": "boutique, sarees, kurtas, ethnic wear, tailoring, jewellery, handloom, handicraft, home decor",
        "fonts": GF + "Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,400&family=Jost:wght@300;400;500;600&family=Noto+Serif+Devanagari:wght@500;600",
        "font": {"head": "'Bodoni Moda',Didot,serif", "body": "'Jost',system-ui,sans-serif", "hindi": "'Noto Serif Devanagari',serif"},
        "palettes": {
            "ivory":  {"bg": "#F8F5F0", "alt": "#EFEAE2", "ink": "#151311", "muted": "#6E675F", "line": "#E2DBD0", "primary": "#151311", "primary_ink": "#F8F5F0", "accent": "#9A7353"},
            "rani":   {"bg": "#FBF6F6", "alt": "#F3E7E8", "ink": "#1F0E14", "muted": "#765F66", "line": "#E9D8DB", "primary": "#8E1747", "primary_ink": "#FFFFFF", "accent": "#B8914E"},
            "indigo": {"bg": "#F6F5F1", "alt": "#E9E8E1", "ink": "#121729", "muted": "#5E6273", "line": "#DCDBD2", "primary": "#1F2C55", "primary_ink": "#F6F5F1", "accent": "#B5573E"},
        },
        "labels": {"shop": "Shop", "cta": "Shop the collection", "shop_eyebrow": "The collection", "gallery": "Lookbook",
                   "how": "How to order", "contact": "Enquire about a piece", "story": "The label"},
        "hero": "portrait",
    },
    "beauty": {
        "layout": "beauty.html", "variant": "beauty",
        "for": "mehendi artist, makeup artist, beauty parlour, salon, nail art, spa, threading, wellness",
        "fonts": GF + "Marcellus&family=Jost:wght@300;400;500;600&family=Noto+Serif+Devanagari:wght@500;600",
        "font": {"head": "'Marcellus',Georgia,serif", "body": "'Jost',system-ui,sans-serif", "hindi": "'Noto Serif Devanagari',serif"},
        "palettes": {
            "blush":   {"bg": "#FBF7F4", "alt": "#F3E8E2", "ink": "#2A1E1E", "muted": "#7A6664", "line": "#EADBD4", "primary": "#8E4A55", "primary_ink": "#FFFFFF", "accent": "#B89270"},
            "henna":   {"bg": "#F9F6EF", "alt": "#EEE9DB", "ink": "#22201A", "muted": "#6E6A5B", "line": "#E1DBC8", "primary": "#5E5A2E", "primary_ink": "#FFFFFF", "accent": "#A8603A"},
            "aubergine": {"bg": "#FAF7F8", "alt": "#EFE8EC", "ink": "#22161F", "muted": "#715F6B", "line": "#E4D8DF", "primary": "#5A2A4E", "primary_ink": "#FFFFFF", "accent": "#BE9A62"},
        },
        "labels": {"shop": "Services", "cta": "Book an appointment", "shop_eyebrow": "Service menu", "gallery": "Portfolio",
                   "how": "How booking works", "contact": "Book an appointment", "story": "About the artist"},
        "hero": "landscape",
    },
    "education": {
        "layout": "education.html", "variant": "education",
        "for": "tuition, coaching, school subjects, music/dance/art/language classes, skill courses",
        "fonts": GF + "Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@500;600;700",
        "font": {"head": "'Plus Jakarta Sans',system-ui,sans-serif", "body": "'Plus Jakarta Sans',system-ui,sans-serif", "hindi": "'Noto Sans Devanagari',sans-serif"},
        "palettes": {
            "navy":   {"bg": "#F7F9FC", "alt": "#EDF1F7", "ink": "#0F1B2D", "muted": "#56637A", "line": "#DCE3EE", "primary": "#1D4E89", "primary_ink": "#FFFFFF", "accent": "#E3A23B"},
            "emerald": {"bg": "#F6FAF8", "alt": "#EAF3EF", "ink": "#0E1F19", "muted": "#53675E", "line": "#D7E5DE", "primary": "#0F6B4F", "primary_ink": "#FFFFFF", "accent": "#E59A3D"},
            "maroon": {"bg": "#FBF8F7", "alt": "#F3ECEA", "ink": "#21141A", "muted": "#6F5F63", "line": "#E8DCDA", "primary": "#7A1F35", "primary_ink": "#FFFFFF", "accent": "#D8A23F"},
        },
        "labels": {"shop": "Courses", "cta": "Enquire now", "shop_eyebrow": "Programs & batches", "gallery": "Inside our classes",
                   "how": "How to join", "contact": "Register / enquire", "story": "Meet your teacher"},
        "hero": "landscape",
    },
}

CATEGORY_ARCHETYPE = {"food": "homefood", "bakery": "bakery", "beauty": "beauty", "tutoring": "education",
                      "services": "education", "boutique": "boutique", "handicraft": "boutique", "other": "boutique"}

# Lucide-style line icons (24x24, stroke). Inner SVG markup only.
ICONS = {
    "truck":   '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    "leaf":    '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>',
    "home":    '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    "clock":   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "shield":  '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    "heart":   '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    "sparkle": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    "users":   '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.3"/><path d="M18 14.3c1.8.8 3 2.6 3 4.7"/>',
    "pin":     '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "phone":   '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    "message": '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    "bag":     '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    "plus":    '<path d="M12 5v14M5 12h14"/>',
    "x":       '<path d="M6 6l12 12M18 6L6 18"/>',
    "arrow":   '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "check":   '<path d="M5 12.5l4.5 4.5L19 7"/>',
    "gift":    '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M12 9v11M3.5 13h17"/><path d="M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9z"/>',
    "package": '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    "scissors": '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 18M8 15.5L20 6"/>',
    "book":    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    "utensils": '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 1-3 3.5-3 6.5V13h3v8"/>',
    "cash":    '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9v.01M18 15v.01"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "star":    '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
}
ICONS["menu"] = '<path d="M4 7h16M4 12h16M4 17h10"/>'
ICONS["award"] = '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>'
ICONS["palette"] = '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'
ICONS["flame"] = '<path d="M12 21c4 0 7-2.7 7-6.6 0-3.9-3-6.4-4.4-9.4-.6 2.7-2.1 4-3.6 4.6.4-2.4-.4-4.6-2-6.6C8.5 6.5 5 9.6 5 14.4 5 18.3 8 21 12 21z"/>'
ICONS["globe"] = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'
FEATURE_ICONS = [k for k in ICONS if k not in {"plus", "x", "arrow", "check", "bag", "message", "phone", "pin"}]
