import type { InspectionScope, Priority } from "@/lib/domain/types";

/**
 * Default pre-handover checklist for a two-storey townhouse.
 * Items with `locations` expand into one checklist item per location, so the
 * inspector ticks each room separately. Everything here is editable in-app;
 * this file only seeds new properties.
 */

/** Default rooms of a TH99B-style two-storey townhouse (editable in-app). */
export const DEFAULT_ROOMS = {
  frontParking: { floor: "ชั้น 1", name: "หน้าบ้าน / ที่จอดรถ" },
  living: { floor: "ชั้น 1", name: "ห้องนั่งเล่น" },
  dining: { floor: "ชั้น 1", name: "ห้องรับประทานอาหาร" },
  kitchen: { floor: "ชั้น 1", name: "ครัว" },
  bath1: { floor: "ชั้น 1", name: "ห้องน้ำ" },
  stairs: { floor: null, name: "บันได / โถงบันได" },
  back: { floor: "ชั้น 1", name: "หลังบ้าน / ซักล้าง" },
  master: { floor: "ชั้น 2", name: "ห้องนอนใหญ่" },
  masterBath: { floor: "ชั้น 2", name: "ห้องน้ำห้องนอนใหญ่" },
  bed2: { floor: "ชั้น 2", name: "ห้องนอน 2" },
  bed3: { floor: "ชั้น 2", name: "ห้องนอน 3" },
  bath2: { floor: "ชั้น 2", name: "ห้องน้ำรวม" },
  roof: { floor: null, name: "หลังคา / ใต้หลังคา" },
  exterior: { floor: null, name: "ภายนอกอาคาร / รอบบ้าน" },
} as const satisfies Record<string, { floor: string | null; name: string }>;

/** Display label used as the item/defect `location` snapshot. */
export const roomLabel = (r: { floor: string | null; name: string }) => (r.floor ? `${r.floor} - ${r.name}` : r.name);

export const LOCATIONS = Object.fromEntries(Object.entries(DEFAULT_ROOMS).map(([k, r]) => [k, roomLabel(r)])) as { [K in keyof typeof DEFAULT_ROOMS]: string };

const L = LOCATIONS;
const INTERIOR = [L.living, L.dining, L.kitchen, L.bath1, L.stairs, L.master, L.masterBath, L.bed2, L.bed3, L.bath2];
const DRY_ROOMS = [L.living, L.dining, L.stairs, L.master, L.bed2, L.bed3];
const BATHROOMS = [L.bath1, L.masterBath, L.bath2];
const WET_AREAS = [...BATHROOMS, L.kitchen, L.back];
const BEDROOMS = [L.master, L.bed2, L.bed3];
const ELECTRIC_ROOMS = [L.frontParking, L.living, L.dining, L.kitchen, L.bath1, L.stairs, L.back, L.master, L.masterBath, L.bed2, L.bed3, L.bath2];

export interface TemplateItem {
  title: string;
  description?: string;
  method: string;
  criteria: string;
  priority: Priority;
  locations?: readonly string[];
  /** Overrides the category scope. */
  scope?: InspectionScope;
}

export interface TemplateCategory {
  code: string;
  name: string;
  scope: InspectionScope;
  items: TemplateItem[];
}

export const CHECKLIST_TEMPLATE: TemplateCategory[] = [
  {
    code: "DOC",
    scope: "GENERAL",
    name: "เอกสารและการส่งมอบ",
    items: [
      { title: "ตรวจสอบเลขแปลง แบบบ้าน และพื้นที่ตรงตามสัญญา", method: "เทียบเลขแปลง แบบบ้าน เนื้อที่ดิน (ตร.ว.) กับสัญญาจะซื้อจะขายและโฉนด", criteria: "ข้อมูลตรงกันทุกจุด", priority: "HIGH" },
      { title: "รับเอกสารรับประกันและคู่มือบ้าน", method: "ขอเอกสารรับประกันโครงสร้าง/งานระบบ คู่มือเครื่องใช้ไฟฟ้า แบบ As-built", criteria: "ได้รับครบและระบุระยะเวลารับประกันชัดเจน", priority: "MEDIUM" },
      { title: "ตรวจนับกุญแจ รีโมท และบัตรผ่าน", method: "นับกุญแจทุกประตู ทดลองไขทุกดอก ทดสอบรีโมท/คีย์การ์ด", criteria: "ครบตามรายการส่งมอบ และใช้งานได้ทุกชิ้น", priority: "MEDIUM" },
      { title: "จดเลขมิเตอร์ไฟฟ้าและน้ำประปา ณ วันตรวจ", method: "ถ่ายรูปหน้าปัดมิเตอร์ไฟและน้ำพร้อมวันที่", criteria: "มีหลักฐานเลขมิเตอร์ก่อนรับโอน", priority: "LOW" },
    ],
  },
  {
    code: "STR",
    scope: "ENGINEERING",
    name: "โครงสร้างและภายนอกอาคาร",
    items: [
      { title: "รอยร้าวที่ผนังภายนอก เสา และคาน", description: "รอยร้าวแนวเฉียง 45° หรือร้าวทะลุอาจบ่งชี้ปัญหาโครงสร้าง", method: "เดินรอบบ้าน ส่องไฟฉายตามมุมเสา-คาน วัดความกว้างรอยร้าวด้วยบัตรวัดรอยร้าว", criteria: "ไม่มีรอยร้าวแนวเฉียง/ทะลุ รอยร้าวผิวปูนกว้างไม่เกิน 0.3 มม.", priority: "CRITICAL", locations: [L.exterior] },
      { title: "การทรุดตัวของพื้นที่จอดรถและรอบบ้าน", method: "สังเกตรอยแยกระหว่างตัวบ้านกับพื้นรอบนอก ใช้ระดับน้ำตรวจความลาดเอียง", criteria: "ไม่มีโพรงใต้พื้น รอยแยกไม่ขยายตัว ลาดเอียงออกจากตัวบ้าน", priority: "HIGH", locations: [L.frontParking, L.back] },
      { title: "สีภายนอก รอยด่าง คราบ และการลอกล่อน", method: "ตรวจด้วยสายตาในระยะ 1-2 เมตร ภายใต้แสงธรรมชาติ", criteria: "สีเรียบสม่ำเสมอ ไม่ลอก ไม่มีคราบน้ำ/ตะไคร่", priority: "LOW", locations: [L.exterior] },
      { title: "รั้ว ประตูรั้ว และราวกันตก", method: "ทดลองเปิด-ปิดประตูรั้ว ล็อก เขย่าราวกันตก ตรวจรอยเชื่อมและสนิม", criteria: "แข็งแรง ไม่โยก ไม่มีสนิม/คมเหล็ก เปิดปิดลื่น", priority: "MEDIUM", locations: [L.frontParking, L.back] },
      { title: "ท่อระบายน้ำ บ่อพัก และการไหลของน้ำรอบบ้าน", method: "เปิดฝาบ่อพัก เทน้ำทดสอบการไหล ตรวจเศษปูนอุดตัน", criteria: "น้ำไหลสะดวก ไม่มีเศษวัสดุอุดตัน ฝาบ่อเรียบเสมอพื้น", priority: "HIGH", locations: [L.frontParking, L.back] },
      { title: "จุดเชื่อมต่อผนังกับบ้านข้างเคียง (Party wall)", method: "ตรวจรอยต่อด้านหน้า-หลัง และใต้หลังคาว่ามีช่องว่างหรือรอยร้าว", criteria: "ปิดสนิท ไม่มีรอยแยกหรือแสงลอด", priority: "MEDIUM", locations: [L.exterior] },
    ],
  },
  {
    code: "ROOF",
    scope: "GENERAL",
    name: "หลังคา รางน้ำ และฝ้าใต้หลังคา",
    items: [
      { title: "กระเบื้องหลังคา แตก เลื่อน หรือแนวไม่ตรง", method: "มองจากระยะไกล/ใช้โดรนหรือกล้องซูม ตรวจครอบสันและแนวกระเบื้อง", criteria: "ไม่มีแผ่นแตก/เลื่อน แนวตรงสม่ำเสมอ", priority: "HIGH", locations: [L.roof] },
      { title: "รอยรั่วซึมและคราบน้ำใต้หลังคา", method: "เปิดช่องเซอร์วิสฝ้า ส่องไฟฉายดูแผ่นสะท้อนความร้อน โครงหลังคา และคราบน้ำ (ตรวจหลังฝนตกจะดีที่สุด)", criteria: "ไม่มีคราบน้ำ แสงลอด หรือรอยชื้น", priority: "CRITICAL", locations: [L.roof] },
      { title: "รางน้ำฝนและท่อน้ำทิ้งจากหลังคา", method: "ฉีดน้ำทดสอบที่รางน้ำ ดูการไหลลงท่อ ตรวจข้อต่อรั่ว", criteria: "น้ำไหลไม่ขัง ไม่รั่วตามข้อต่อ ท่อยึดแน่น", priority: "MEDIUM", locations: [L.roof] },
      { scope: "ENGINEERING", title: "ฉนวนกันความร้อนและโครงหลังคา", method: "ตรวจฉนวนปูเต็มพื้นที่ โครงเหล็กไม่เป็นสนิม รอยเชื่อมทาสีกันสนิม", criteria: "ฉนวนครบ โครงไม่มีสนิมหรือรอยเชื่อมไม่สมบูรณ์", priority: "MEDIUM", locations: [L.roof] },
    ],
  },
  {
    code: "WALL",
    scope: "GENERAL",
    name: "ผนัง งานฉาบ และงานสี",
    items: [
      { scope: "ENGINEERING", title: "รอยร้าวผนังภายใน", method: "ส่องไฟฉายเฉียงขนานผนัง ตรวจมุมวงกบประตู-หน้าต่าง", criteria: "ไม่มีรอยร้าวแนวเฉียง รอยร้าวลายงาต้องแจ้งเก็บ", priority: "HIGH", locations: INTERIOR },
      { title: "ความเรียบและได้ดิ่งของผนัง", method: "ใช้ไม้บรรทัดอะลูมิเนียมยาว 2 ม. ทาบผนัง ส่องไฟเฉียง", criteria: "ผนังเรียบ ไม่เป็นคลื่น ช่องว่างใต้ไม้บรรทัดไม่เกิน 3 มม.", priority: "LOW", locations: INTERIOR },
      { title: "งานสีภายใน: สีด่าง ไม่เรียบ คราบเปื้อน", method: "ตรวจด้วยสายตาภายใต้แสงไฟและแสงธรรมชาติ", criteria: "สีสม่ำเสมอ ไม่มีรอยแปรง คราบสี หรือฝุ่นติด", priority: "LOW", locations: INTERIOR },
      { title: "ผนังกลวง (เคาะฟังเสียง)", method: "ใช้ค้อนยางหรือด้ามไขควงเคาะผนังเป็นตาราง ฟังเสียงโปร่ง", criteria: "ไม่มีเสียงกลวงเป็นบริเวณกว้าง", priority: "MEDIUM", locations: INTERIOR },
      { title: "บัวพื้นและบัวฝ้า ติดแน่น รอยต่อเรียบ", method: "ตรวจรอยต่อบัวกับผนัง/พื้น กดดูการยึด", criteria: "ติดแน่น ไม่มีช่องว่าง ยาแนวเรียบ", priority: "LOW", locations: DRY_ROOMS },
    ],
  },
  {
    code: "FLR",
    scope: "GENERAL",
    name: "พื้นและกระเบื้อง",
    items: [
      { title: "กระเบื้องพื้นกลวง (เคาะ)", method: "ใช้ค้อนยาง/ไม้เคาะทุกแผ่น โดยเฉพาะมุมและกลางแผ่น", criteria: "ไม่มีแผ่นกลวง หรือกลวงไม่เกิน 10% ของแผ่นที่มุม", priority: "MEDIUM", locations: INTERIOR },
      { title: "กระเบื้อง/พื้นแตก บิ่น ร่องยาแนวไม่เต็ม", method: "ตรวจด้วยสายตาและลูบมือตามขอบกระเบื้อง", criteria: "ไม่แตกบิ่น ยาแนวเต็มร่องสม่ำเสมอ ระดับขอบเสมอกัน", priority: "LOW", locations: INTERIOR },
      { title: "ระดับพื้นและการลาดเอียงสู่ท่อระบายน้ำ", description: "พื้นที่เปียกต้องลาดลงท่อระบายน้ำ ห้ามน้ำขัง", method: "เทน้ำ/ลูกแก้วทดสอบการไหล ทิ้งไว้ 5-10 นาที ดูน้ำขัง", criteria: "น้ำไหลลงท่อทั้งหมด ไม่มีน้ำขังเกินฝ่ามือ", priority: "HIGH", locations: WET_AREAS },
      { title: "พื้นไม้/ลามิเนตบนชั้นสอง: เสียงดัง ยุบ โก่ง", method: "เดินทั่วห้อง ฟังเสียงลั่น ตรวจรอยต่อและการโก่งตัว", criteria: "ไม่มีเสียงลั่น ไม่ยุบ ไม่โก่ง รอยต่อชิดสนิท", priority: "MEDIUM", locations: [L.stairs, ...BEDROOMS] },
      { scope: "ENGINEERING", title: "ขั้นบันได ลูกนอน ลูกตั้ง และราวบันได", method: "เดินขึ้นลง เขย่าราวจับ วัดความสูงลูกตั้งให้เท่ากัน", criteria: "ราวแน่นไม่โยก ขั้นเท่ากัน ไม่มีขอบคม", priority: "HIGH", locations: [L.stairs] },
    ],
  },
  {
    code: "CEIL",
    scope: "GENERAL",
    name: "ฝ้าเพดาน",
    items: [
      { title: "ฝ้าเพดาน รอยต่อ รอยร้าว และการแอ่นตัว", method: "มองแนวฝ้าในแนวเฉียง ส่องไฟฉายตามรอยต่อแผ่น", criteria: "ระนาบเรียบ ไม่แอ่น ไม่มีรอยร้าวตามรอยต่อ", priority: "MEDIUM", locations: INTERIOR },
      { title: "คราบน้ำหรือรอยรั่วบนฝ้า", method: "สังเกตรอยด่างสีเหลือง/น้ำตาล โดยเฉพาะใต้ห้องน้ำชั้น 2", criteria: "ไม่มีคราบน้ำหรือรอยชื้น", priority: "HIGH", locations: [L.living, L.dining, L.kitchen, L.bath1, ...BEDROOMS] },
      { title: "ช่องเซอร์วิสฝ้า (Access panel)", method: "เปิด-ปิดช่องเซอร์วิสทุกจุด", criteria: "เปิดปิดได้ ฝาเข้าที่สนิท ไม่บิดงอ", priority: "LOW", locations: [L.bath1, L.masterBath, L.bath2, L.stairs] },
    ],
  },
  {
    code: "DOOR",
    scope: "GENERAL",
    name: "ประตูและหน้าต่าง",
    items: [
      { title: "ประตู เปิด-ปิด ฝืด ครูด หรือปิดไม่สนิท", method: "เปิด-ปิดทุกบาน ดูช่องว่างรอบบาน ปล่อยบานค้างครึ่งทางดูว่าเหวี่ยงเองหรือไม่", criteria: "เปิดปิดลื่น ช่องว่างรอบบานสม่ำเสมอ บานไม่เหวี่ยงเอง", priority: "MEDIUM", locations: [L.frontParking, L.kitchen, L.bath1, L.back, L.master, L.masterBath, L.bed2, L.bed3, L.bath2] },
      { title: "ลูกบิด กุญแจ บานพับ และกลอน", method: "ทดลองล็อก/ปลดล็อกทุกจุด ไขกุญแจทุกดอก", criteria: "ล็อกได้จริง ไม่หลวม ไม่มีเสียงดัง", priority: "MEDIUM", locations: [L.frontParking, L.kitchen, L.bath1, L.back, L.master, L.masterBath, L.bed2, L.bed3, L.bath2] },
      { title: "หน้าต่าง/ประตูบานเลื่อน: ล็อก มุ้งลวด ยางกันน้ำ", method: "เลื่อน-ล็อกทุกบาน ตรวจมุ้งลวดขาด ยางขอบบาน", criteria: "เลื่อนลื่น ล็อกแน่น มุ้งลวดไม่ขาด ยางขอบเต็มแนว", priority: "MEDIUM", locations: [L.living, L.dining, L.kitchen, L.stairs, L.master, L.bed2, L.bed3] },
      { title: "การรั่วซึมรอบวงกบหน้าต่าง (ฉีดน้ำทดสอบ)", method: "ฉีดน้ำจากภายนอกที่ขอบวงกบ 5-10 นาที ตรวจด้านในด้วยกระดาษทิชชู", criteria: "ไม่มีน้ำซึมเข้าด้านใน ซิลิโคนเต็มแนว", priority: "HIGH", locations: [L.living, L.dining, L.master, L.bed2, L.bed3] },
      { title: "กระจก: รอยร้าว รอยขีดข่วน คราบ", method: "ตรวจด้วยสายตาทั้งสองด้านของกระจก", criteria: "ไม่ร้าว ไม่มีรอยขีดข่วนลึก", priority: "LOW", locations: [L.living, L.dining, L.kitchen, L.stairs, L.master, L.bed2, L.bed3] },
    ],
  },
  {
    code: "SAN",
    scope: "GENERAL",
    name: "สุขภัณฑ์และระบบประปา",
    items: [
      { title: "ชักโครก: กดชำระ น้ำไหลกลับ การรั่วซึม", method: "กดชักโครก 3 ครั้ง ทิ้งกระดาษทดสอบ ดูน้ำรั่วที่ฐานและวาล์ว", criteria: "ชำระหมด เติมน้ำหยุดสนิท ไม่รั่วที่ฐาน ยึดแน่นไม่โยก", priority: "HIGH", locations: BATHROOMS },
      { title: "อ่างล้างหน้า ก๊อกน้ำ และท่อน้ำทิ้งใต้อ่าง", method: "เปิดน้ำเต็มแรง 1-2 นาที ตรวจใต้อ่างด้วยทิชชูหาจุดรั่ว", criteria: "แรงดันดี น้ำระบายเร็ว ไม่รั่วซึมใต้อ่าง", priority: "HIGH", locations: [...BATHROOMS, L.kitchen] },
      { title: "ฝักบัว สายชำระ และน้ำอุ่น (ถ้ามี)", method: "เปิดใช้งานทุกจุด ตรวจแรงดันและการรั่วที่ข้อต่อ", criteria: "แรงดันพอ ไม่รั่วที่ข้อต่อ เครื่องทำน้ำอุ่นทำงานและมีสายดิน", priority: "MEDIUM", locations: BATHROOMS },
      { title: "ซิลิโคนและยาแนวในห้องน้ำ", method: "ตรวจรอยต่อระหว่างอ่าง/ชักโครก/ผนัง/พื้น", criteria: "ซิลิโคนเต็มแนว ไม่หลุดลอก ไม่มีเชื้อรา", priority: "LOW", locations: BATHROOMS },
      { title: "ปั๊มน้ำและถังเก็บน้ำ", method: "เปิดน้ำหลายจุดพร้อมกัน ฟังเสียงปั๊ม ตรวจปั๊มตัดต่อถี่ผิดปกติ", criteria: "ปั๊มทำงานเงียบ ตัดต่อปกติ ไม่มีน้ำรั่วที่ถัง/ข้อต่อ", priority: "HIGH", locations: [L.back] },
      { title: "มิเตอร์น้ำ: ทดสอบน้ำรั่วในระบบ", description: "ปิดก๊อกทุกจุดแล้วดูว่ามิเตอร์ยังหมุนหรือไม่", method: "ปิดน้ำทุกจุด จดเลขมิเตอร์ รอ 30 นาทีแล้วเทียบ", criteria: "เลขมิเตอร์ไม่เปลี่ยน", priority: "HIGH", locations: [L.frontParking] },
      { title: "ซิงค์ครัว ท่อน้ำทิ้ง และบ่อดักไขมัน", method: "เปิดน้ำเต็มซิงค์แล้วปล่อย ตรวจใต้ซิงค์ เปิดบ่อดักไขมัน", criteria: "ระบายเร็ว ไม่รั่ว บ่อดักไขมันสะอาดไม่มีเศษวัสดุ", priority: "MEDIUM", locations: [L.kitchen, L.back] },
    ],
  },
  {
    code: "ELEC",
    scope: "GENERAL",
    name: "ระบบไฟฟ้าและแสงสว่าง",
    items: [
      { scope: "ENGINEERING", title: "เต้ารับไฟฟ้า: ไฟเข้า ขั้ว และสายดิน", description: "ใช้ปลั๊กเทสเตอร์ (มีไฟแสดงสถานะ) ทดสอบทุกจุด", method: "เสียบปลั๊กเทสเตอร์ทุกเต้ารับ ตรวจไฟสถานะขั้ว L/N/G", criteria: "ทุกเต้ารับไฟเข้า ขั้วถูกต้อง มีสายดิน หน้ากากแน่น", priority: "CRITICAL", locations: ELECTRIC_ROOMS },
      { title: "สวิตช์และดวงโคม", method: "เปิด-ปิดทุกสวิตช์ ตรวจไฟติดตรงจุด หน้ากากแน่น", criteria: "ทุกดวงติด สวิตช์ไม่หลวม ไม่มีเสียงหรือกลิ่นไหม้", priority: "MEDIUM", locations: ELECTRIC_ROOMS },
      { scope: "ENGINEERING", title: "ตู้ไฟ (Consumer unit) และเบรกเกอร์กันดูด (RCBO/RCD)", method: "เปิดตู้ ตรวจป้ายวงจร กดปุ่ม TEST ของ RCBO/RCD ต้องตัดทันที", criteria: "มีป้ายชื่อวงจรครบ RCD ตัดเมื่อกด TEST สายเรียบร้อย ไม่มีรอยไหม้", priority: "CRITICAL", locations: [L.frontParking, L.living] },
      { title: "จุดติดตั้งเครื่องปรับอากาศและเบรกเกอร์แยก", method: "ตรวจจุดเตรียมท่อแอร์ เต้ารับ/เบรกเกอร์แยกสำหรับแอร์", criteria: "มีจุดเตรียมครบตามแบบ เบรกเกอร์แยกวงจร", priority: "MEDIUM", locations: BEDROOMS },
      { title: "กริ่ง โทรศัพท์ อินเทอร์เน็ต และ TV outlet", method: "ทดสอบกริ่ง ตรวจจุด LAN/TV ตามแบบ", criteria: "ครบตามแบบ ใช้งานได้", priority: "LOW", locations: [L.frontParking, L.living, L.master] },
      { title: "พัดลมระบายอากาศห้องน้ำ", method: "เปิดใช้งาน ทดสอบแรงดูดด้วยกระดาษทิชชู", criteria: "ทำงาน ไม่มีเสียงดังผิดปกติ ดูดอากาศได้จริง", priority: "LOW", locations: BATHROOMS },
    ],
  },
  {
    code: "KIT",
    scope: "GENERAL",
    name: "ครัวและบิวท์อิน",
    items: [
      { title: "เคาน์เตอร์และตู้บิวท์อิน: บานตู้ ลิ้นชัก มือจับ", method: "เปิดปิดทุกบานและลิ้นชัก ตรวจบานพับปรับระดับ", criteria: "บานตรงแนว เปิดปิดลื่น ไม่มีรอยแตก ผิวไม่บวมน้ำ", priority: "LOW", locations: [L.kitchen, L.master] },
      { title: "ท็อปเคาน์เตอร์และซิลิโคนรอบซิงค์", method: "ตรวจรอยแตก บิ่น และซิลิโคนรอบซิงค์/ผนัง", criteria: "ไม่แตกบิ่น ซิลิโคนเต็มแนว", priority: "LOW", locations: [L.kitchen] },
    ],
  },
];

export const DEFAULT_PROJECT = {
  name: "Siri Place Rama 2",
  developer: "Sansiri Public Company Limited",
  developer_contact: null,
  location: "พระราม 2 กรุงเทพมหานคร",
  description: "Pre-handover Inspection — บ้านทาวน์โฮม 2 ชั้น",
} as const;

export const DEFAULT_PROPERTY = {
  name: "บ้านแปลง 1240-032002",
  plot_number: "1240-032002",
  house_model: "TH99B",
  property_type: "Two-storey townhouse",
  land_area_sqw: 16.2,
  usable_area_sqm: 99,
  floors: 2,
  construction_status: "READY_FOR_INSPECTION",
  inspection_type: "Pre-handover Inspection",
  inspection_owner: "Project Owner",
  transfer_date_planned: "2026-11-18",
  transfer_date_actual: null,
  claim_window_days: 15,
  warranty_info: "สิทธิแจ้งเก็บงานตามหมวดงานรับประกันมาตรฐาน 1 ครั้ง ภายใน 15 วันนับจากวันจดทะเบียนโอนกรรมสิทธิ์ (ตามเอกสารจอง)",
  price: 2305000,
  booking_fee: 2000,
  cashback: 300000,
  notes: "ข้อมูลการเงินเป็นข้อมูลประกอบโครงการเท่านั้น ไม่ใช่ส่วนหนึ่งของการประเมินคุณภาพทางวิศวกรรม",
} as const;
