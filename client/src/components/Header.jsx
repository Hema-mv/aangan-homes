export default function Header({ deal, onDeal, cities, city, onCity, q, onQ, savedCount, savedOnly, onToggleSaved, enquiryCount, onEnquiries, onPost, live }) {
  return (
    <header className="top wrap">
      <div className="inner">
        <div className="logo" aria-label="Aangan Homes">
          <img src="/favicon.svg" width="30" height="30" alt="" />
          <span>Aangan<span className="full"> Homes</span></span>
        </div>
        <div className="deal" role="group" aria-label="Buy or rent">
          <button type="button" aria-pressed={deal === "buy"} onClick={() => onDeal("buy")}>Buy</button>
          <button type="button" aria-pressed={deal === "rent"} onClick={() => onDeal("rent")}>Rent</button>
        </div>
        <div className="search">
          <select aria-label="City" value={city} onChange={(e) => onCity(e.target.value)}>
            {(cities ?? [{ name: city }]).map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
          <span className="sep" />
          <input type="search" placeholder="Locality, project or landmark" aria-label="Search locality" value={q} onChange={(e) => onQ(e.target.value)} />
        </div>
        <LiveBadge {...live} />
        <button className="hbtn" type="button" aria-pressed={savedOnly} onClick={onToggleSaved}>Saved <span className="count">{savedCount}</span></button>
        <button className="hbtn" type="button" onClick={onEnquiries}>Enquiries <span className="count">{enquiryCount}</span></button>
        <button className="hbtn solid" type="button" onClick={onPost}>Post property</button>
      </div>
    </header>
  );
}

function LiveBadge({ status, online }) {
  const label = status === "live" ? `${online} online` : status === "connecting" ? "Connecting…" : "Offline";
  return (
    <span className={"livebadge " + status} title={status === "live" ? "New listings appear here instantly" : "Live updates paused"}>
      <i aria-hidden="true" />{label}
    </span>
  );
}
