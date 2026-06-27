import sys

with open("src/components/ClientLayoutWrapper.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Truck icon to imports
if "Truck," not in content and "Truck " not in content:
    content = content.replace("PackageX,", "PackageX, Truck,")

# 2. Update mainNav
nav_old = """    { name: "Expired", icon: PackageX, children: [
      { name: t("nav.expiries"), href: "/dashboard/expiries-audit", icon: ClipboardList },
      { name: "Product Lookup", href: "/admin/product-lookup", icon: Search }
    ]},
    { name: "Admin", icon: Shield, children: ["""

nav_new = """    { name: "Expired", icon: PackageX, children: [
      { name: t("nav.expiries"), href: "/dashboard/expiries-audit", icon: ClipboardList },
      { name: "Product Lookup", href: "/admin/product-lookup", icon: Search }
    ]},
    { name: "Supplier Returns", href: "/dashboard/supplier-returns", icon: Truck },
    { name: "Admin", icon: Shield, children: ["""
content = content.replace(nav_old, nav_new)

# 3. Update Badges
badge_old_1 = """{item.name === "Expired" && (pendingExpiriesCount + pendingReturnsCount) > 0 && ("""
badge_new_1 = """{item.name === "Expired" && pendingExpiriesCount > 0 && ("""
content = content.replace(badge_old_1, badge_new_1)

badge_old_2 = """{pendingExpiriesCount + pendingReturnsCount}"""
badge_new_2 = """{pendingExpiriesCount}"""
content = content.replace(badge_old_2, badge_new_2)
# there are two of these replacement inside desktop and mobile nav
content = content.replace(badge_old_2, badge_new_2)

# we need to add pendingReturnsCount badge to the Supplier Returns nav item.
# Find where the top level non-dropdown badges are rendered. 
# actually Supplier Returns is a top-level link without children.
# Let's see:
supplier_badge_insert = """                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-red-600 dark:bg-red-500 rounded-t-full shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
                    )}
                  </Link>
                );"""

supplier_badge_replacement = """                    {item.name === "Supplier Returns" && pendingReturnsCount > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ml-1">
                        {pendingReturnsCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-red-600 dark:bg-red-500 rounded-t-full shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
                    )}
                  </Link>
                );"""
content = content.replace(supplier_badge_insert, supplier_badge_replacement)

# mobile nav
mobile_badge_insert = """                  </Link>
                );"""

mobile_badge_replacement = """                    {item.name === "Supplier Returns" && pendingReturnsCount > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                        {pendingReturnsCount}
                      </span>
                    )}
                  </Link>
                );"""
# this will replace all `</Link>);` at the bottom which is risky.
# Let's be more specific.

mobile_nav_top_level_old = """              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href || item.name}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-500"
                      : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-red-600 dark:text-red-500" : "text-muted-foreground"}`} />
                  {item.name}
                </Link>
              );"""

mobile_nav_top_level_new = """              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href || item.name}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-500"
                      : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${isActive ? "text-red-600 dark:text-red-500" : "text-muted-foreground"}`} />
                    {item.name}
                  </div>
                  {item.name === "Supplier Returns" && pendingReturnsCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                      {pendingReturnsCount}
                    </span>
                  )}
                </Link>
              );"""
content = content.replace(mobile_nav_top_level_old, mobile_nav_top_level_new)

with open("src/components/ClientLayoutWrapper.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("done")
