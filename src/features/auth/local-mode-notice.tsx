import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LocalModeNotice() {
  return (
    <div className="space-y-3 rounded-md border bg-card p-5">
      <p className="font-semibold">ระบบยังไม่ได้เชื่อมต่อ Cloud</p>
      <p className="text-sm text-muted-foreground">ยังไม่ได้ตั้งค่า Supabase จึงทำงานแบบ Local mode ข้อมูลเก็บในเครื่องนี้ เมื่อเชื่อม Cloud แล้ว ข้อมูลจะถูก Sync ขึ้นบัญชีของคุณหลังเข้าสู่ระบบ</p>
      <Button asChild className="w-full"><Link href="/">เข้าใช้งาน</Link></Button>
    </div>
  );
}
