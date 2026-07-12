import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATION_LABELS, type LocationType } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — ELGA Café" }] }),
});

function InventoryPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  // Scope by portal role:
  //  - Central Store   → only raw ingredients at central_store
  //  - Central Bakery  → only finished products at central_bakery
  //  - Branch 1 / 2    → only that branch (both tabs)
  //  - Admin           → full access, all locations
  const scope = useMemo(() => {
    if (isAdmin) return { location: null as LocationType | null, itemType: null as "ingredient" | "product" | null };
    if (roles.includes("central_store")) return { location: "central_store" as LocationType, itemType: "ingredient" as const };
    if (roles.includes("central_bakery")) return { location: "central_bakery" as LocationType, itemType: null };
    if (roles.includes("branch_1")) return { location: "branch_1" as LocationType, itemType: null };
    if (roles.includes("branch_2")) return { location: "branch_2" as LocationType, itemType: null };
    return { location: null, itemType: null };
  }, [roles, isAdmin]);

  const [location, setLocation] = useState<LocationType | "all">(scope.location ?? "all");

  const effectiveLocation: LocationType | "all" = scope.location ?? location;

  const { data: ingredients } = useQuery({
    queryKey: ["inv-ing", effectiveLocation],
    enabled: scope.itemType !== "product",
    queryFn: async () => {
      let q = supabase.from("inventory").select("*, ingredients(name, unit, min_stock)").eq("item_type", "ingredient");
      if (effectiveLocation !== "all") q = q.eq("location", effectiveLocation);
      const { data } = await q;
      return (data ?? []).filter((r: any) => r.ingredients);
    },
  });

  const { data: products } = useQuery({
    queryKey: ["inv-prod", effectiveLocation],
    enabled: scope.itemType !== "ingredient",
    queryFn: async () => {
      let q = supabase.from("inventory").select("*, products(name, unit, min_stock)").eq("item_type", "product");
      if (effectiveLocation !== "all") q = q.eq("location", effectiveLocation);
      const { data } = await q;
      return (data ?? []).filter((r: any) => r.products);
    },
  });

  const showLocationPicker = scope.location === null;
  const showIngredientsTab = scope.itemType !== "product";
  const showProductsTab = scope.itemType !== "ingredient";
  const defaultTab = scope.itemType === "product" ? "products" : "ingredients";

  const subtitle = scope.location
    ? `${LOCATION_LABELS[scope.location]}${scope.itemType === "ingredient" ? " · raw ingredients" : scope.itemType === "product" ? " · finished products" : ""}`
    : "Current stock across all locations.";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Stock Levels</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
        {showLocationPicker && (
          <Select value={location} onValueChange={(v) => setLocation(v as any)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {Object.entries(LOCATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {showIngredientsTab && <TabsTrigger value="ingredients">Raw Ingredients</TabsTrigger>}
          {showProductsTab && <TabsTrigger value="products">Finished Products</TabsTrigger>}
        </TabsList>
        {showIngredientsTab && (
          <TabsContent value="ingredients">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Min Stock</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(ingredients ?? []).map((r: any) => {
                    const low = Number(r.quantity) < Number(r.ingredients.min_stock);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.ingredients.name}</TableCell>
                        <TableCell>{LOCATION_LABELS[r.location as LocationType]}</TableCell>
                        <TableCell className="text-right">{Number(r.quantity).toFixed(2)} {r.ingredients.unit}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.ingredients.min_stock} {r.ingredients.unit}</TableCell>
                        <TableCell>{low ? <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning/40 gap-1"><AlertTriangle className="h-3 w-3" />Low</Badge> : <Badge variant="outline" className="bg-success/15 text-success-foreground border-success/40">OK</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(ingredients ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No inventory records</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        )}
        {showProductsTab && (
          <TabsContent value="products">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Min Stock</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(products ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.products.name}</TableCell>
                      <TableCell>{LOCATION_LABELS[r.location as LocationType]}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity).toFixed(2)} {r.products.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.products.min_stock}</TableCell>
                    </TableRow>
                  ))}
                  {(products ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No products in stock</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
