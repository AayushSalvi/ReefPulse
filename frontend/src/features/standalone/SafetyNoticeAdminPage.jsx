/**
 * Standalone manager UI — NOT mounted in `src/App.jsx`.
 * Wire to an admin route when authentication exists. Uses `managerFeed` from mock data.
 */
import { managerFeed } from "../../data/mockData";

function SafetyNoticeAdminPage() {
  return (
    <section>
      <h1>Safety Notice (Manager/Admin)</h1>
      <p className="lead">
        Operator-side management page for warnings, closures, and public safety communication.
      </p>

      <div className="grid two-col">
        <article className="panel">
          <h2>Publish or Update Notice</h2>
          <form className="stack">
            <label>
              Beach / Coastal Area
              <input type="text" placeholder="e.g. Huntington Beach" />
            </label>
            <label>
              Notice Type
              <select defaultValue="Advisory">
                <option>Advisory</option>
                <option>Warning</option>
                <option>Closure</option>
              </select>
            </label>
            <label>
              Public Message
              <textarea rows={4} placeholder="Post closure/warning details..." />
            </label>
            <div className="inline-buttons">
              <button type="button">Publish Update</button>
              <button type="button">Trigger Notification</button>
            </div>
          </form>
        </article>

        <article className="panel">
          <h2>Risk Queue + Current Notices</h2>
          <p>High-risk locations: Huntington Beach, Ocean Beach</p>
          <ul>
            {managerFeed.map((item) => (
              <li key={`${item.location}-${item.type}`}>
                {item.location} - {item.type}: {item.message}
              </li>
            ))}
          </ul>
          <p>Published notices flow to Location Detail, Forecast & Alerts, and Home Map badges.</p>
        </article>
      </div>
    </section>
  );
}

export default SafetyNoticeAdminPage;
