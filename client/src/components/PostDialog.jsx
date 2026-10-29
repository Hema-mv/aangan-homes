import { useMemo, useState } from "react";
import Modal, { CloseButton } from "./Modal.jsx";
import { Field } from "./DetailDialog.jsx";
import { api } from "../api.js";
import { inr, money } from "../lib/format.js";

export default function PostDialog({ open, onClose, cities, defaultCity, onCreated }) {
  return (
    <Modal open={open} onClose={onClose} label="Post a property">
      {cities && <PostForm cities={cities} defaultCity={defaultCity} onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function PostForm({ cities, defaultCity, onClose, onCreated }) {
  const [f, setF] = useState(() => {
    const city = cities.find((c) => c.name === defaultCity) ?? cities[0];
    return { deal: "buy", type: "Apartment", city: city.name, locality: "", title: "", bhk: "2",
      area: "1200", price: "", possession: "Ready to move", agent: "", phone: "" };
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const city = cities.find((c) => c.name === f.city);
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const hint = useMemo(() => {
    const name = f.locality.trim().replace(/\s+/g, " "), a = +f.area;
    if (name.length < 2) return "";
    const loc = city?.localities.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!loc) return `“${name}” is new to ${f.city}. We'll add it, and estimate prices from similar homes nearby.`;
    const rate = f.deal === "rent" ? loc.rentRate : loc.saleRate;
    if (!rate || !a) return "";
    const basis = loc.rateSource === "listings" ? "from current listings" : "indicative";
    return f.deal === "rent"
      ? `Locality guide (${basis}): about ₹${inr(rate * a)}/month for ${inr(a)} sq ft in ${loc.name}.`
      : `Locality guide (${basis}): about ${money(rate * a)} for ${inr(a)} sq ft in ${loc.name}.`;
  }, [city, f.city, f.locality, f.area, f.deal]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      const listing = await api.createListing({ ...f, bhk: f.type === "Plot" ? 0 : +f.bhk, area: +f.area, price: +f.price });
      onCreated(listing);
    } catch (err) {
      setErrors(err.fields && Object.keys(err.fields).length ? err.fields : { _: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="postdlg">
      <CloseButton onClick={onClose} />
      <h2 className="dtitle">Post a property</h2>
      <p className="note" style={{ margin: 0 }}>Your listing goes live for everyone browsing right now.</p>
      <form className="post" onSubmit={submit} noValidate>
        <div className="row2">
          <Field id="pdeal" label="Listing for"><select id="pdeal" value={f.deal} onChange={set("deal")}><option value="buy">Sale</option><option value="rent">Rent</option></select></Field>
          <Field id="ptype" label="Property type"><select id="ptype" value={f.type} onChange={set("type")}>{["Apartment", "Villa", "Independent House", "Plot"].map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <div className="row2">
          <Field id="pcity" label="City" error={errors.city}><select id="pcity" value={f.city} onChange={set("city")}>{cities.map((c) => <option key={c.name}>{c.name}</option>)}</select></Field>
          <Field id="ploc" label="Locality" error={errors.locality}>
            <input id="ploc" list="ploc-list" required maxLength={40} autoComplete="off" placeholder="Pick or type any area"
              value={f.locality} onChange={set("locality")} aria-invalid={!!errors.locality} />
            <datalist id="ploc-list">{city.localities.map((l) => <option key={l.name} value={l.name} />)}</datalist>
          </Field>
        </div>
        <Field id="ptitle" label="Headline" error={errors.title}>
          <input id="ptitle" required maxLength={70} placeholder="e.g. Corner 3BHK near metro station" value={f.title} onChange={set("title")} />
        </Field>
        <div className="row2">
          <Field id="pbhk" label="BHK"><select id="pbhk" value={f.type === "Plot" ? "0" : f.bhk} onChange={set("bhk")} disabled={f.type === "Plot"}>
            {["1", "2", "3", "4", "5"].map((b) => <option key={b}>{b}</option>)}<option value="0">Plot / NA</option></select></Field>
          <Field id="parea" label="Super built-up (sq ft)" error={errors.area}><input id="parea" type="number" min="100" required value={f.area} onChange={set("area")} /></Field>
        </div>
        <div className="row2">
          <Field id="pprice" label={f.deal === "rent" ? "Monthly rent (₹)" : "Price (₹)"} error={errors.price}>
            <input id="pprice" type="number" min="1000" required placeholder={f.deal === "rent" ? "e.g. 35000" : "e.g. 9500000"} value={f.price} onChange={set("price")} />
          </Field>
          <Field id="pposs" label="Possession"><select id="pposs" value={f.possession} onChange={set("possession")}>
            <option>Ready to move</option><option>Under construction · Dec 2027</option><option>Available now</option></select></Field>
        </div>
        {hint && <div className="note">{hint}</div>}
        <div className="row2">
          <Field id="pagent" label="Agent name" error={errors.agent}><input id="pagent" required autoComplete="name" value={f.agent} onChange={set("agent")} /></Field>
          <Field id="pph" label="Agent mobile" error={errors.phone}><input id="pph" required inputMode="tel" placeholder="98xxx xxxxx" value={f.phone} onChange={set("phone")} /></Field>
        </div>
        {errors._ && <div className="err" role="alert">{errors._}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish listing"}</button>
      </form>
    </div>
  );
}
