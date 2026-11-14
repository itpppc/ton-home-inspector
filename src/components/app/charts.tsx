"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 12, fill: "var(--color-muted-foreground)" };
const tooltipStyle = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-foreground)", fontSize: 13 };

export function ProgressByCategoryChart({ data }: { data: { name: string; PASS: number; FAIL: number; NEEDS_REINSPECTION: number; NOT_APPLICABLE: number; NOT_CHECKED: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barSize={16}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="PASS" name="ผ่าน" stackId="a" fill="#16a34a" />
        <Bar isAnimationActive={false} dataKey="FAIL" name="ไม่ผ่าน" stackId="a" fill="#dc2626" />
        <Bar isAnimationActive={false} dataKey="NEEDS_REINSPECTION" name="ตรวจซ้ำ" stackId="a" fill="#d97706" />
        <Bar isAnimationActive={false} dataKey="NOT_APPLICABLE" name="N/A" stackId="a" fill="#0891b2" />
        <Bar isAnimationActive={false} dataKey="NOT_CHECKED" name="ยังไม่ตรวจ" stackId="a" fill="#94a3b8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const shown = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie isAnimationActive={false} data={shown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="var(--color-card)">
          {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, color = "#7c3aed" }: { data: { name: string; count: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -16, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={axis} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Bar isAnimationActive={false} dataKey="count" name="จำนวน" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
