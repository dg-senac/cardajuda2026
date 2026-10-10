"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ChartPoint {
  data: string;
  sistolica: number;
  diastolica: number;
  glicemia: number;
}

export default function PacienteChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0d6ea" />
          <XAxis dataKey="data" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="sistolica" stroke="#8B008B" strokeWidth={2} dot={false} name="Sistólica" />
          <Line type="monotone" dataKey="diastolica" stroke="#D62839" strokeWidth={2} dot={false} name="Diastólica" />
          <Line type="monotone" dataKey="glicemia" stroke="#F2A900" strokeWidth={2} dot={false} name="Glicemia" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
