import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, MapPin, Phone, Building, Calendar, User, TrendingUp, ShieldCheck, ShieldX, Clock } from "lucide-react";

export default function FieldReports() {
  const [selectedEmp, setSelectedEmp] = useState<string>("all");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: employees } = useSupabaseTable<any>("employees", "id, name, role, email, status");
  const { data: visits } = useSupabaseTable<any>(
    "society_data",
    "id, employee_id, name, address, contact_person, contact_phone, number_of_flats, verification_status, lat, lng, created_at, selfie_url, building_photo_url"
  );
  const { data: shifts } = useSupabaseTable<any>(
    "employee_shifts",
    "id, employee_id, started_at, ended_at, duration_min, visit_count"
  );

  const activeEmployees = useMemo(
    () => employees.filter((e: any) => e.status === "Active"),
    [employees]
  );

  const monthStart = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [monthStart]);

  const filteredVisits = useMemo(() => {
    return visits.filter((v: any) => {
      const d = new Date(v.created_at);
      if (d < monthStart || d >= monthEnd) return false;
      if (selectedEmp !== "all" && v.employee_id !== selectedEmp) return false;
      return true;
    });
  }, [visits, monthStart, monthEnd, selectedEmp]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((s: any) => {
      const d = new Date(s.started_at);
      if (d < monthStart || d >= monthEnd) return false;
      if (selectedEmp !== "all" && s.employee_id !== selectedEmp) return false;
      return true;
    });
  }, [shifts, monthStart, monthEnd, selectedEmp]);

  const summaryStats = useMemo(() => {
    const total = filteredVisits.length;
    let real = 0, fake = 0, pending = 0;
    for (const v of filteredVisits) {
      const st = v.verification_status || "pending";
      if (st === "verified_real") real++;
      else if (st === "verified_fake") fake++;
      else pending++;
    }
    const totalShiftMin = filteredShifts.reduce((s: number, sh: any) => s + (sh.duration_min || 0), 0);
    const shiftHours = Math.round(totalShiftMin / 60 * 10) / 10;
    return { total, real, fake, pending, shiftHours, shiftCount: filteredShifts.length };
  }, [filteredVisits, filteredShifts]);

  const dailyChart = useMemo(() => {
    const days: Record<string, number> = {};
    for (const v of filteredVisits) {
      const day = new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      days[day] = (days[day] || 0) + 1;
    }
    return Object.entries(days).map(([label, count]) => ({ label, count }));
  }, [filteredVisits]);

  const perEmployee = useMemo(() => {
    const map: Record<string, { name: string; visits: number; real: number; fake: number; pending: number; hours: number }> = {};
    for (const e of activeEmployees) {
      map[e.id] = { name: e.name, visits: 0, real: 0, fake: 0, pending: 0, hours: 0 };
    }
    for (const v of filteredVisits) {
      if (!map[v.employee_id]) continue;
      map[v.employee_id].visits++;
      const st = v.verification_status || "pending";
      if (st === "verified_real") map[v.employee_id].real++;
      else if (st === "verified_fake") map[v.employee_id].fake++;
      else map[v.employee_id].pending++;
    }
    for (const s of filteredShifts) {
      if (!map[s.employee_id]) continue;
      map[s.employee_id].hours += (s.duration_min || 0) / 60;
    }
    return Object.values(map).filter(e => e.visits > 0).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, filteredShifts, activeEmployees]);

  const empName = (id: string) => employees.find((e: any) => e.id === id)?.name || "Unknown";

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  const exportCSV = () => {
    const headers = ["Date", "Employee", "Society", "Address", "Contact Person", "Contact Phone", "Flats", "Status"];
    const rows = filteredVisits.map((v: any) => [
      new Date(v.created_at).toLocaleDateString("en-IN"),
      empName(v.employee_id),
      v.name,
      v.address || "",
      v.contact_person || "",
      v.contact_phone || "",
      v.number_of_flats || "",
      v.verification_status || "pending",
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `field-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [groupBy, setGroupBy] = useState<"none" | "date" | "employee">("none");

  const groupedByDate = useMemo(() => {
    if (groupBy !== "date") return null;
    const groups: Record<string, Record<string, any[]>> = {};
    for (const v of filteredVisits) {
      const isoDate = v.created_at.slice(0, 10);
      if (!groups[isoDate]) groups[isoDate] = {};
      const empId = v.employee_id;
      if (!groups[isoDate][empId]) groups[isoDate][empId] = [];
      groups[isoDate][empId].push(v);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredVisits, groupBy]);

  const groupedByEmployee = useMemo(() => {
    if (groupBy !== "employee") return null;
    const groups: Record<string, Record<string, any[]>> = {};
    for (const v of filteredVisits) {
      const empId = v.employee_id;
      if (!groups[empId]) groups[empId] = {};
      const isoDate = v.created_at.slice(0, 10);
      if (!groups[empId][isoDate]) groups[empId][isoDate] = [];
      groups[empId][isoDate].push(v);
    }
    return Object.entries(groups).sort((a, b) => {
      const nameA = empName(a[0]);
      const nameB = empName(b[0]);
      return nameA.localeCompare(nameB);
    });
  }, [filteredVisits, groupBy, employees]);

  // Visit details table
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Field Reports</h1>
          <p className="text-sm text-muted-foreground">Monthly field activity by employee</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {activeEmployees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-2xl font-bold">{summaryStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Visits</div>
        </Card>
        <Card className="p-4 text-center">
          <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-green-600" />
          <div className="text-2xl font-bold text-green-600">{summaryStats.real}</div>
          <div className="text-xs text-muted-foreground">Verified Real</div>
        </Card>
        <Card className="p-4 text-center">
          <ShieldX className="w-5 h-5 mx-auto mb-1 text-blue-600" />
          <div className="text-2xl font-bold text-blue-600">{summaryStats.fake}</div>
          <div className="text-xs text-muted-foreground">Verified Fake</div>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-amber-600" />
          <div className="text-2xl font-bold text-amber-600">{summaryStats.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-600" />
          <div className="text-2xl font-bold">{summaryStats.shiftCount}</div>
          <div className="text-xs text-muted-foreground">Shifts</div>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-purple-600" />
          <div className="text-2xl font-bold">{summaryStats.shiftHours}h</div>
          <div className="text-xs text-muted-foreground">Field Hours</div>
        </Card>
      </div>

      {/* Daily chart */}
      {dailyChart.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Daily Visits</h3>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={dailyChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Per-employee table (only when "all") */}
      {selectedEmp === "all" && perEmployee.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Employee-wise Summary</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Visits</TableHead>
                  <TableHead className="text-center">Real</TableHead>
                  <TableHead className="text-center">Fake</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perEmployee.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-center font-bold">{e.visits}</TableCell>
                    <TableCell className="text-center text-green-600">{e.real}</TableCell>
                    <TableCell className="text-center text-blue-600">{e.fake}</TableCell>
                    <TableCell className="text-center text-amber-600">{e.pending}</TableCell>
                    <TableCell className="text-center">{Math.round(e.hours * 10) / 10}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Visit details table */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4 border-b pb-3">
          <h3 className="text-sm font-semibold">Visit Details ({filteredVisits.length})</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Group by:</span>
            <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex gap-1">
              <Button
                variant={groupBy === "none" ? "secondary" : "ghost"}
                className={`h-7 px-2.5 text-[11px] font-semibold ${groupBy === 'none' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setGroupBy("none")}
              >
                None
              </Button>
              <Button
                variant={groupBy === "date" ? "secondary" : "ghost"}
                className={`h-7 px-2.5 text-[11px] font-semibold ${groupBy === 'date' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setGroupBy("date")}
              >
                Date
              </Button>
              <Button
                variant={groupBy === "employee" ? "secondary" : "ghost"}
                className={`h-7 px-2.5 text-[11px] font-semibold ${groupBy === 'employee' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setGroupBy("employee")}
              >
                Employee
              </Button>
            </div>
          </div>
        </div>

        {groupBy === "none" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {selectedEmp === "all" && <TableHead>Employee</TableHead>}
                  <TableHead>Society</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Flats</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.slice(0, 100).map((v: any) => {
                  const st = v.verification_status || "pending";
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </TableCell>
                      {selectedEmp === "all" && (
                        <TableCell className="text-xs font-medium">{empName(v.employee_id)}</TableCell>
                      )}
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{v.address || "-"}</TableCell>
                      <TableCell className="text-xs">{v.contact_person || "-"}</TableCell>
                      <TableCell className="text-xs">{v.contact_phone || "-"}</TableCell>
                      <TableCell className="text-center">{v.number_of_flats || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            st === "verified_real" ? "bg-green-50 text-green-700 border-green-200" :
                            st === "verified_fake" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredVisits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No visits found for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredVisits.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing 100 of {filteredVisits.length} visits. Export CSV for full data.
              </p>
            )}
          </div>
        )}

        {groupBy === "date" && (
          <div className="space-y-6">
            {groupedByDate?.map(([isoDate, empsObj]) => {
              const formattedDate = new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const dayTotal = Object.values(empsObj).reduce((sum, list) => sum + list.length, 0);

              return (
                <div key={isoDate} className="border border-border/60 rounded-lg overflow-hidden bg-slate-50/20 dark:bg-slate-900/10">
                  <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 border-b flex justify-between items-center">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {formattedDate}
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-950 font-bold">{dayTotal} visits</Badge>
                  </div>

                  <div className="p-3 space-y-4">
                    {Object.entries(empsObj).map(([empId, list]) => (
                      <div key={empId} className="space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {empName(empId)} <span className="font-normal text-muted-foreground/80">({list.length} visits)</span>
                        </div>
                        <div className="overflow-x-auto border border-border/40 rounded-md bg-card">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="h-8 py-1.5 text-[11px]">Society</TableHead>
                                <TableHead className="h-8 py-1.5 text-[11px]">Address</TableHead>
                                <TableHead className="h-8 py-1.5 text-[11px]">Contact</TableHead>
                                <TableHead className="h-8 py-1.5 text-[11px]">Phone</TableHead>
                                <TableHead className="h-8 py-1.5 text-[11px] text-center">Flats</TableHead>
                                <TableHead className="h-8 py-1.5 text-[11px] text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.map((v: any) => {
                                const st = v.verification_status || "pending";
                                return (
                                  <TableRow key={v.id}>
                                    <TableCell className="font-medium text-xs py-2">{v.name}</TableCell>
                                    <TableCell className="text-xs py-2 max-w-[200px] truncate">{v.address || "-"}</TableCell>
                                    <TableCell className="text-xs py-2">{v.contact_person || "-"}</TableCell>
                                    <TableCell className="text-xs py-2">{v.contact_phone || "-"}</TableCell>
                                    <TableCell className="text-center text-xs py-2">{v.number_of_flats || "-"}</TableCell>
                                    <TableCell className="text-center py-2">
                                      <Badge
                                        variant="outline"
                                        className={
                                          st === "verified_real" ? "bg-green-50 text-green-700 border-green-200 text-[10px] py-0 px-1.5" :
                                          st === "verified_fake" ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5" :
                                          "bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5"
                                        }
                                      >
                                        {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {groupBy === "employee" && (
          <div className="space-y-6">
            {groupedByEmployee?.map(([empId, datesObj]) => {
              const empTotal = Object.values(datesObj).reduce((sum, list) => sum + list.length, 0);

              return (
                <div key={empId} className="border border-border/60 rounded-lg overflow-hidden bg-slate-50/20 dark:bg-slate-900/10">
                  <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 border-b flex justify-between items-center">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {empName(empId)}
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-950 font-bold">{empTotal} visits</Badge>
                  </div>

                  <div className="p-3 space-y-4">
                    {Object.entries(datesObj)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([isoDate, list]) => {
                        const formattedDate = new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        });

                        return (
                          <div key={isoDate} className="space-y-1.5">
                            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 px-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formattedDate} <span className="font-normal text-muted-foreground/80">({list.length} visits)</span>
                            </div>
                            <div className="overflow-x-auto border border-border/40 rounded-md bg-card">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-8 py-1.5 text-[11px]">Society</TableHead>
                                    <TableHead className="h-8 py-1.5 text-[11px]">Address</TableHead>
                                    <TableHead className="h-8 py-1.5 text-[11px]">Contact</TableHead>
                                    <TableHead className="h-8 py-1.5 text-[11px]">Phone</TableHead>
                                    <TableHead className="h-8 py-1.5 text-[11px] text-center">Flats</TableHead>
                                    <TableHead className="h-8 py-1.5 text-[11px] text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {list.map((v: any) => {
                                    const st = v.verification_status || "pending";
                                    return (
                                      <TableRow key={v.id}>
                                        <TableCell className="font-medium text-xs py-2">{v.name}</TableCell>
                                        <TableCell className="text-xs py-2 max-w-[200px] truncate">{v.address || "-"}</TableCell>
                                        <TableCell className="text-xs py-2">{v.contact_person || "-"}</TableCell>
                                        <TableCell className="text-xs py-2">{v.contact_phone || "-"}</TableCell>
                                        <TableCell className="text-center text-xs py-2">{v.number_of_flats || "-"}</TableCell>
                                        <TableCell className="text-center py-2">
                                          <Badge
                                            variant="outline"
                                            className={
                                              st === "verified_real" ? "bg-green-50 text-green-700 border-green-200 text-[10px] py-0 px-1.5" :
                                              st === "verified_fake" ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5" :
                                              "bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5"
                                            }
                                          >
                                            {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
