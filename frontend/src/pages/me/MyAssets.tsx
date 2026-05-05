import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Laptop, ShieldCheck, Calendar, MapPin } from "lucide-react";
import { formatDate, formatCurrency, statusColor } from "../../utils/formatters";
import api from "../../api/client";

interface Asset {
  id: string; assetTag: string; name: string; category: string;
  manufacturer: string | null; model: string | null; serialNumber: string | null;
  purchaseDate: string | null; purchasePrice: string | null; warrantyExpiry: string | null;
  status: string; location: string | null; notes: string | null;
}

export default function MyAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const res = await api.get("/me/assets"); setAssets(res.data.data || []); }
      catch { setAssets([]); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <PageWrapper title="My Assets" subtitle="Equipment and software assigned to you">
      {loading ? <div className="py-20"><LoadingSpinner /></div> :
        assets.length === 0 ? <EmptyState title="No assets assigned" description="When IT assigns equipment to you it will appear here." /> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => (
            <Card key={a.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FE" }}>
                      <Laptop size={18} className="text-[#5B21B6]" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono text-[#6B5F8F] dark:text-[#B8AEDD]">{a.assetTag}</div>
                      <div className="font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{a.name}</div>
                    </div>
                  </div>
                  <Badge variant={statusColor(a.status) as "default" | "success" | "warning" | "danger" | "info"}>{a.status}</Badge>
                </div>

                <dl className="text-xs space-y-1.5 text-[#6B5F8F] dark:text-[#C8BFE6]">
                  <Row label="Category" value={a.category} />
                  {a.manufacturer && <Row label="Manufacturer" value={a.manufacturer} />}
                  {a.model && <Row label="Model" value={a.model} />}
                  {a.serialNumber && <Row label="Serial" value={a.serialNumber} mono />}
                  {a.location && <Row label="Location" value={a.location} icon={<MapPin size={11} />} />}
                  {a.purchaseDate && <Row label="Purchased" value={formatDate(a.purchaseDate)} icon={<Calendar size={11} />} />}
                  {a.warrantyExpiry && <Row label="Warranty" value={formatDate(a.warrantyExpiry)} icon={<ShieldCheck size={11} />} />}
                  {a.purchasePrice && <Row label="Value" value={formatCurrency(Number(a.purchasePrice))} />}
                </dl>

                {a.notes && (
                  <p className="mt-3 pt-3 border-t border-[#E8E4F3] dark:border-[#2E2850] text-xs text-[#6B5F8F] dark:text-[#C8BFE6]">
                    {a.notes}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      }
    </PageWrapper>
  );
}

function Row({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1 text-[#6B5F8F] dark:text-[#B8AEDD]">{icon}{label}</dt>
      <dd className={`text-[#1E1B2E] dark:text-[#EDE9FE] ${mono ? "font-mono text-[10.5px]" : ""}`}>{value}</dd>
    </div>
  );
}
