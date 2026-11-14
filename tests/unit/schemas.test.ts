import { describe, expect, it } from "vitest";
import { propertySchema, registerSchema } from "@/lib/domain/schemas";

const baseProperty = {
  name: "บ้าน", plot_number: "", house_model: "", property_type: "", land_area_sqw: "16.20", usable_area_sqm: "", floors: "2",
  construction_status: "READY_FOR_INSPECTION", inspection_type: "", inspection_owner: "", transfer_date_planned: "2026-11-18",
  transfer_date_actual: "", claim_window_days: "", warranty_info: "", price: "2,305,000", booking_fee: "", cashback: "", notes: "",
};

describe("propertySchema", () => {
  it("normalises empty strings to null and parses numbers", () => {
    const v = propertySchema.parse(baseProperty);
    expect(v.land_area_sqw).toBe(16.2);
    expect(v.price).toBe(2305000);
    expect(v.transfer_date_actual).toBeNull();
    expect(v.claim_window_days).toBe(15);
    expect(v.plot_number).toBeNull();
  });

  it("rejects invalid values", () => {
    expect(propertySchema.safeParse({ ...baseProperty, floors: "1.5" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...baseProperty, land_area_sqw: "-1" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...baseProperty, transfer_date_actual: "18/11/2026" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...baseProperty, name: "  " }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("enforces password policy and confirmation", () => {
    const ok = { full_name: "TON", email: "A@B.co", password: "abc12345", confirm: "abc12345" };
    expect(registerSchema.parse(ok).email).toBe("a@b.co");
    expect(registerSchema.safeParse({ ...ok, password: "abcdefgh", confirm: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, confirm: "x" }).success).toBe(false);
  });
});
