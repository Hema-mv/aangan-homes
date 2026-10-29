import { useState } from "react";
import Modal, { CloseButton } from "./Modal.jsx";
import HouseArt from "./HouseArt.jsx";
import { CompareButton, PriceLine } from "./ValuePill.jsx";
import { api } from "../api.js";
import { buyCosts, daysAgo, inr, money, valueTag, STAMP_DUTY_PCT } from "../lib/format.js";

export default function DetailDialog({ listing: l, city, open, onClose, comparing, onToggleCompare, onEnquirySent, onCopied }) {
  return (
    <Modal open={open && !!l} onClose={onClose} label={l?.title}>
      {l && (
        <div className="dlg">
          <div className="hero"><HouseArt listing={l} /><CloseButton onClick={onClose} /></div>
          <div className="side">
            <div>
              <PriceLine listing={l} />
              <h2>{l.title}</h2>
              <div className="where">{l.locality}, {l.city} · listed {daysAgo(l.daysListed)}</div>
              <div className="crow" style={{ marginTop: 10 }}>
                <CompareButton active={comparing} onClick={onToggleCompare} />
                {l.enquiryCount > 0 && <span className="activity">{l.enquiryCount} {l.enquiryCount === 1 ? "enquiry" : "enquiries"} so far</span>}
              </div>
            </div>
            <dl className="kv" style={{ margin: 0 }}>
              <KV k="Config" v={l.bhk ? `${l.bhk} BHK` : "Plot"} />
              <KV k="Super built-up" v={`${inr(l.area)} sq ft`} />
              <KV k="Bathrooms" v={l.bhk ? l.bath : "—"} />
              <KV k="Floor" v={l.floor} /><KV k="Facing" v={l.facing} /><KV k="Furnishing" v={l.furnishing} />
              <KV k="Possession" v={l.possession.replace("Under construction · ", "Due ")} />
              <KV k="Age" v={l.age} />
              <KV k="Carpet (est.)" v={l.type === "Plot" ? "—" : `${inr(l.area * 0.75)} sq ft`} />
            </dl>
            <EstimateBar listing={l} />
            {l.deal === "buy" ? <EmiCalculator listing={l} /> : <MoveInCost listing={l} city={city} />}
            {l.amenities.length > 0 && (
              <div className="sect"><h3>Amenities</h3><div className="amen">{l.amenities.map((a) => <span key={a}>{a}</span>)}</div></div>
            )}
            <div className="sect">
              <h3>Listed by</h3>
              <div className="agent">
                <div className="av">{l.agent.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                <div className="who">
                  <b>{l.agent}</b>
                  <div className="note">{l.firm}</div>
                  <div className="ph">{l.phone ?? "Sample agent · no real number"}</div>
                </div>
                {l.phone && (
                  <button className="btn ghost" type="button"
                    onClick={() => navigator.clipboard?.writeText(l.phone).then(onCopied, () => {})}>Copy number</button>
                )}
              </div>
            </div>
            <EnquiryForm key={l.id} listing={l} onSent={onEnquirySent} />
          </div>
        </div>
      )}
    </Modal>
  );
}

const KV = ({ k, v }) => <div><dt>{k}</dt><dd>{v}</dd></div>;

function EstimateBar({ listing: l }) {
  const lo = l.estimate * 0.75, hi = l.estimate * 1.25;
  const pos = Math.max(4, Math.min(96, ((l.price - lo) / (hi - lo)) * 100));
  const adj = l.type === "Villa" || l.type === "Independent House" ? ", +8% for independent homes" : l.type === "Plot" ? ", −5% for land" : "";
  return (
    <div className="sect">
      <h3>Price vs {l.locality} estimate</h3>
      <div className="bar"><span className="mk est" style={{ left: "50%" }}>Estimate {money(l.estimate)}</span></div>
      <div className="bar" style={{ marginTop: 4 }}><span className="mk you" style={{ left: pos + "%" }}>This home {money(l.price)}</span></div>
      <div className="barlbl"><span>Good value</span><span>{valueTag(l.diffPct).label}</span><span>Premium</span></div>
      <p className="note" style={{ margin: "6px 0 0" }}>Estimate = indicative {l.locality} rate × area{adj}.</p>
    </div>
  );
}

function EmiCalculator({ listing: l }) {
  const [downPct, setDown] = useState(20), [rate, setRate] = useState(8.5), [years, setYears] = useState(20);
  const c = buyCosts(l.price, { downPct, rate, years });
  return (
    <div className="sect">
      <h3>Home loan EMI</h3>
      <div className="emi">
        <div><span className="out">₹{inr(c.monthly)}</span> <span className="note">per month</span></div>
        <Slider label="Down payment" id="dp" min={10} max={60} step={5} value={downPct} onChange={setDown} out={downPct + "%"} />
        <Slider label="Interest rate" id="ir" min={7} max={11} step={0.05} value={rate} onChange={setRate} out={rate.toFixed(2) + "%"} />
        <Slider label="Tenure" id="yr" min={5} max={30} step={1} value={years} onChange={setYears} out={years + " yrs"} />
        <div className="note">
          Loan ₹{inr(c.loan)} · down payment ₹{inr(c.downPayment)} · total interest ₹{inr(c.totalInterest)}.
          Add ~{STAMP_DUTY_PCT}% stamp duty and registration in {l.city}.
        </div>
      </div>
    </div>
  );
}

function Slider({ label, id, out, onChange, ...rest }) {
  return (
    <label htmlFor={id}>
      {label}
      <input type="range" id={id} {...rest} onChange={(e) => onChange(+e.target.value)} />
      <output htmlFor={id}>{out}</output>
    </label>
  );
}

function MoveInCost({ listing: l, city }) {
  const months = city?.depositMonths ?? 3;
  return (
    <div className="sect">
      <h3>Move-in cost</h3>
      <div className="kv">
        <KV k="Rent" v={"₹" + inr(l.price)} />
        <KV k={`Deposit (${months} mo)`} v={"₹" + inr(l.price * months)} />
        <KV k="Maintenance" v={`~₹${inr(Math.round((l.area * 3) / 100) * 100)}/mo`} />
      </div>
    </div>
  );
}

function EnquiryForm({ listing: l, onSent }) {
  const [form, setForm] = useState({
    name: "", phone: "", visit: "This weekend",
    message: `Hi, I'm interested in this ${l.bhk ? l.bhk + " BHK " : ""}${l.type.toLowerCase()} in ${l.locality}. Is it still available?`,
  });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState("sending"); setErrors({});
    try {
      const enquiry = await api.createEnquiry(l.id, form);
      setState("sent");
      onSent(enquiry);
    } catch (err) {
      setState("idle");
      setErrors(err.fields && Object.keys(err.fields).length ? err.fields : { _: err.message });
    }
  }

  if (state === "sent") return <div className="ok">Enquiry sent to {l.agent}. You'll find it under Enquiries.</div>;

  return (
    <form className="enq" onSubmit={submit} noValidate>
      <div className="sect" style={{ margin: 0 }}><h3>Request a site visit</h3></div>
      <div className="row2">
        <Field id="en" label="Your name" error={errors.name}>
          <input id="en" required autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field id="ep" label="Mobile" error={errors.phone}>
          <input id="ep" required inputMode="tel" placeholder="98xxx xxxxx" autoComplete="tel" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
        </Field>
      </div>
      <Field id="ew" label="Preferred visit">
        <select id="ew" value={form.visit} onChange={set("visit")}>
          <option>This weekend</option><option>Weekday evening</option><option>Video walkthrough</option>
        </select>
      </Field>
      <Field id="em" label="Message" error={errors.message}>
        <textarea id="em" rows={2} maxLength={500} value={form.message} onChange={set("message")} />
      </Field>
      {errors._ && <div className="err" role="alert">{errors._}</div>}
      <button className="btn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}

export function Field({ id, label, error, children }) {
  return (
    <label className="field" htmlFor={id}>
      {label}
      {children}
      {error && <span className="err" id={id + "-err"}>{error}</span>}
    </label>
  );
}
