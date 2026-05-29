// @ts-nocheck
import { useState } from "react";
import { supabase } from "../integrations/supabase/client";

export default function DocumentsPage() {
  const [form, setForm] = useState({
    document_type: "driver_license",
    file_name: "",
    file_data_url: "",
  });
  const [msg, setMsg] = useState("");

  function selectFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        file_name: file.name,
        file_data_url: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const { error } = await supabase.rpc("be_rider_document_save", {
      p_payload: form,
    });

    setMsg(error ? error.message : "Document uploaded for verification.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">Document Management</h1>
        <p className="font-semibold text-slate-600">
          Upload ID, driver license, vehicle documents, and verification files.
        </p>

        <select
          className="mt-5 w-full rounded-2xl border p-3 font-bold"
          value={form.document_type}
          onChange={(e) => setForm({ ...form, document_type: e.target.value })}
        >
          <option value="driver_license">Driver License</option>
          <option value="national_id">National ID / NRC</option>
          <option value="vehicle_registration">Vehicle Registration</option>
          <option value="insurance">Insurance</option>
        </select>

        <input
          className="mt-4 w-full rounded-2xl border p-3"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => selectFile(e.target.files?.[0])}
        />

        {form.file_name && (
          <p className="mt-3 font-bold text-slate-600">Selected: {form.file_name}</p>
        )}

        {msg && (
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">
            {msg}
          </div>
        )}

        <button
          onClick={save}
          className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white"
        >
          Submit Document
        </button>
      </div>
    </div>
  );
}
