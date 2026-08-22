"use client";

import { useState } from "react";
import { getAllProvinces, getDistrictsByProvince, getSubdistrictsByDistrict } from "@/lib/thai-address";

interface ThaiAddressFieldsProps {
  idPrefix?: string;
  defaultProvince?: string | null;
  defaultDistrict?: string | null;
  defaultSubdistrict?: string | null;
  disabled?: boolean;
}

export function ThaiAddressFields({
  idPrefix = "addr",
  defaultProvince = "",
  defaultDistrict = "",
  defaultSubdistrict = "",
  disabled = false,
}: ThaiAddressFieldsProps) {
  const [selectedProvince, setSelectedProvince] = useState(defaultProvince || "");
  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict || "");
  const [selectedSubdistrict, setSelectedSubdistrict] = useState(defaultSubdistrict || "");

  const provinces = getAllProvinces();
  const availableDistricts = selectedProvince ? getDistrictsByProvince(selectedProvince) : [];
  const availableSubdistricts = selectedProvince && selectedDistrict ? getSubdistrictsByDistrict(selectedProvince, selectedDistrict) : [];

  return (
    <>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-province`}>จังหวัด</label>
        <select
          id={`${idPrefix}-province`}
          name="province"
          value={selectedProvince}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedProvince(val);
            setSelectedDistrict("");
            setSelectedSubdistrict("");
          }}
        >
          <option value="">-- เลือกจังหวัด --</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {selectedProvince && !provinces.includes(selectedProvince) && (
            <option value={selectedProvince}>{selectedProvince}</option>
          )}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-district`}>อำเภอ / เขต</label>
        <select
          id={`${idPrefix}-district`}
          name="district"
          value={selectedDistrict}
          disabled={disabled || !selectedProvince || availableDistricts.length === 0}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedDistrict(val);
            setSelectedSubdistrict("");
          }}
        >
          <option value="">{selectedProvince ? "-- เลือกอำเภอ --" : "-- เลือกจังหวัดก่อน --"}</option>
          {availableDistricts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          {selectedDistrict && !availableDistricts.includes(selectedDistrict) && (
            <option value={selectedDistrict}>{selectedDistrict}</option>
          )}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-subdistrict`}>ตำบล / แขวง</label>
        <select
          id={`${idPrefix}-subdistrict`}
          name="subdistrict"
          value={selectedSubdistrict}
          disabled={disabled || !selectedDistrict || availableSubdistricts.length === 0}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedSubdistrict(val);
          }}
        >
          <option value="">{selectedDistrict ? "-- เลือกตำบล --" : "-- เลือกอำเภอก่อน --"}</option>
          {availableSubdistricts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {selectedSubdistrict && !availableSubdistricts.includes(selectedSubdistrict) && (
            <option value={selectedSubdistrict}>{selectedSubdistrict}</option>
          )}
        </select>
      </div>
    </>
  );
}
