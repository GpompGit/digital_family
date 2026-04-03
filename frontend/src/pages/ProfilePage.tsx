import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

interface Address { id: number; label: string; street: string; city: string; state: string | null; zip: string | null; country: string; year_in: number | null; year_out: number | null }
interface Contact { id: number; contact_type: string; label: string; value: string; is_primary: boolean }
interface IdentityDoc { id: number; doc_type: string; doc_number: string; issuing_country: string | null; issue_date: string | null; expire_date: string | null; notes: string | null }
interface Attribute { id: number; attribute_name: string; attribute_value: string }

interface Profile {
  id: number; email: string | null; first_name: string; last_name: string; birth_date: string | null;
  addresses: Address[]; contacts: Contact[]; identity_docs: IdentityDoc[]; attributes: Attribute[];
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user: currentUser, refresh } = useAuth();
  const { id: paramId } = useParams<{ id: string }>();

  // If viewing another family member's profile (read-only)
  const viewingOtherId = paramId ? parseInt(paramId) : null;
  const isOwnProfile = !viewingOtherId || viewingOtherId === currentUser?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Basic info form
  const [basic, setBasic] = useState({ first_name: '', last_name: '', birth_date: '' });
  // Password form
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });

  async function load() {
    const url = isOwnProfile ? '/api/users/me' : `/api/users/${viewingOtherId}/profile`;
    const { data } = await axios.get(url);
    setProfile(data);
    setBasic({ first_name: data.first_name, last_name: data.last_name, birth_date: data.birth_date?.split('T')[0] || '' });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveBasic() {
    await axios.put('/api/users/me', basic);
    toast.success(t('profile.saved'));
    await refresh();
  }

  async function changePassword() {
    if (pw.new_password !== pw.confirm) { toast.error(t('profile.passwordMismatch')); return; }
    try {
      await axios.put('/api/users/me/password', { current_password: pw.current_password, new_password: pw.new_password });
      toast.success(t('profile.passwordChanged'));
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(m || 'Failed');
    }
  }

  // --- ADDRESS CRUD ---
  async function addAddress() {
    await axios.post('/api/users/me/addresses', { label: 'home', street: '', city: '', country: 'Switzerland' });
    await load();
  }
  async function updateAddress(id: number, data: Partial<Address>) {
    await axios.put(`/api/users/me/addresses/${id}`, data);
    await load();
  }
  async function deleteAddress(id: number) {
    await axios.delete(`/api/users/me/addresses/${id}`);
    await load();
  }

  // --- CONTACT CRUD ---
  async function addContact() {
    await axios.post('/api/users/me/contacts', { contact_type: 'email', label: 'personal', value: '' });
    await load();
  }
  async function updateContact(id: number, data: Partial<Contact>) {
    await axios.put(`/api/users/me/contacts/${id}`, data);
    await load();
  }
  async function deleteContact(id: number) {
    await axios.delete(`/api/users/me/contacts/${id}`);
    await load();
  }

  // --- IDENTITY DOC CRUD ---
  async function addIdentityDoc() {
    await axios.post('/api/users/me/identity-docs', { doc_type: 'passport', doc_number: '' });
    await load();
  }
  async function updateIdentityDoc(id: number, data: Partial<IdentityDoc>) {
    await axios.put(`/api/users/me/identity-docs/${id}`, data);
    await load();
  }
  async function deleteIdentityDoc(id: number) {
    await axios.delete(`/api/users/me/identity-docs/${id}`);
    await load();
  }

  // --- ATTRIBUTES ---
  async function saveAttributes(attrs: Record<string, string>) {
    await axios.put('/api/users/me/attributes', { attributes: attrs });
    await load();
  }

  if (loading || !profile) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6">
            <div className="w-32 h-5 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
              <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const attrMap: Record<string, string> = {};
  for (const a of profile.attributes) attrMap[a.attribute_name] = a.attribute_value;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">
        {isOwnProfile ? t('profile.title') : `${profile.first_name} ${profile.last_name}`}
      </h1>

      {/* Basic Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.basicInfo')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.firstName')}</label>
            <input className={inputCls} value={basic.first_name} onChange={e => setBasic(b => ({ ...b, first_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.lastName')}</label>
            <input className={inputCls} value={basic.last_name} onChange={e => setBasic(b => ({ ...b, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.birthDate')}</label>
            <input type="date" className={inputCls} value={basic.birth_date} onChange={e => setBasic(b => ({ ...b, birth_date: e.target.value }))} />
          </div>
        </div>
        {isOwnProfile && <button onClick={saveBasic} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t('profile.saveBasic')}</button>}
      </div>

      {/* Password — only show on own profile */}
      {isOwnProfile && <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.changePassword')}</h2>
        <div className="space-y-3">
          <input type="password" className={inputCls} placeholder={t('profile.currentPassword')} value={pw.current_password} onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))} />
          <input type="password" className={inputCls} placeholder={t('profile.newPassword')} value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} />
          <input type="password" className={inputCls} placeholder={t('profile.confirmNewPassword')} value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
        </div>
        <button onClick={changePassword} disabled={!pw.current_password || !pw.new_password} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{t('profile.changePassword')}</button>
      </div>}

      {/* Addresses */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.addresses')}</h2>
          {isOwnProfile && <button onClick={addAddress} className="text-blue-600 text-xs hover:underline">+ {t('profile.addAddress')}</button>}
        </div>
        {profile.addresses.map(addr => (
          <div key={addr.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t('profile.street')} value={addr.street} onBlur={e => updateAddress(addr.id, { ...addr, street: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, street: v } : a) } : p); }} />
              <input className={inputCls} placeholder={t('profile.city')} value={addr.city} onBlur={e => updateAddress(addr.id, { ...addr, city: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, city: v } : a) } : p); }} />
              <input className={inputCls} placeholder={t('profile.zip')} value={addr.zip || ''} onBlur={e => updateAddress(addr.id, { ...addr, zip: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, zip: v } : a) } : p); }} />
              <input className={inputCls} placeholder={t('profile.state')} value={addr.state || ''} onBlur={e => updateAddress(addr.id, { ...addr, state: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, state: v } : a) } : p); }} />
              <input className={inputCls} placeholder={t('profile.country')} value={addr.country} onBlur={e => updateAddress(addr.id, { ...addr, country: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, country: v } : a) } : p); }} />
              <div className="flex gap-2">
                <input type="number" className={inputCls} placeholder={t('profile.yearIn')} value={addr.year_in || ''} onBlur={e => updateAddress(addr.id, { ...addr, year_in: parseInt(e.target.value) || null })} onChange={e => { const v = parseInt(e.target.value) || null; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, year_in: v } : a) } : p); }} />
                <input type="number" className={inputCls} placeholder={t('profile.yearOut')} value={addr.year_out || ''} onBlur={e => updateAddress(addr.id, { ...addr, year_out: parseInt(e.target.value) || null })} onChange={e => { const v = parseInt(e.target.value) || null; setProfile(p => p ? { ...p, addresses: p.addresses.map(a => a.id === addr.id ? { ...a, year_out: v } : a) } : p); }} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              {!addr.year_out && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{t('profile.currentAddress')}</span>}
              {isOwnProfile && <button onClick={() => deleteAddress(addr.id)} className="text-red-600 hover:underline text-xs">{t('admin.delete')}</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Contacts */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.contacts')}</h2>
          {isOwnProfile && <button onClick={addContact} className="text-blue-600 text-xs hover:underline">+ {t('profile.addContact')}</button>}
        </div>
        {profile.contacts.map(c => (
          <div key={c.id} className="flex gap-2 items-center">
            <select className={'px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'} value={c.contact_type} onChange={e => updateContact(c.id, { ...c, contact_type: e.target.value })}>
              <option value="email">{t('profile.contactEmail')}</option>
              <option value="phone">{t('profile.contactPhone')}</option>
              <option value="mobile">{t('profile.contactMobile')}</option>
            </select>
            <select className={'px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'} value={c.label} onChange={e => updateContact(c.id, { ...c, label: e.target.value })}>
              <option value="personal">{t('profile.labelPersonal')}</option>
              <option value="work">{t('profile.labelWork')}</option>
              <option value="emergency">{t('profile.labelEmergency')}</option>
            </select>
            <input className={'flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'} value={c.value} placeholder={t('profile.contactValue')} onBlur={e => updateContact(c.id, { ...c, value: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, contacts: p.contacts.map(x => x.id === c.id ? { ...x, value: v } : x) } : p); }} />
            {isOwnProfile && <button onClick={() => deleteContact(c.id)} className="text-red-500 text-sm px-1 hover:text-red-700">&times;</button>}
          </div>
        ))}
      </div>

      {/* Identity Documents */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.identityDocs')}</h2>
          {isOwnProfile && <button onClick={addIdentityDoc} className="text-blue-600 text-xs hover:underline">+ {t('profile.addIdentityDoc')}</button>}
        </div>
        {profile.identity_docs.map(doc => (
          <div key={doc.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={doc.doc_type} onChange={e => updateIdentityDoc(doc.id, { ...doc, doc_type: e.target.value })}>
                <option value="passport">{t('profile.passport')}</option>
                <option value="id_card">{t('profile.idCard')}</option>
                <option value="driver_license">{t('profile.driverLicense')}</option>
                <option value="residence_permit">{t('profile.residencePermit')}</option>
                <option value="other">{t('profile.otherDoc')}</option>
              </select>
              <input className={inputCls} placeholder={t('profile.docNumber')} value={doc.doc_number} onBlur={e => updateIdentityDoc(doc.id, { ...doc, doc_number: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, identity_docs: p.identity_docs.map(d => d.id === doc.id ? { ...d, doc_number: v } : d) } : p); }} />
              <input className={inputCls} placeholder={t('profile.issuingCountry')} value={doc.issuing_country || ''} onBlur={e => updateIdentityDoc(doc.id, { ...doc, issuing_country: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => p ? { ...p, identity_docs: p.identity_docs.map(d => d.id === doc.id ? { ...d, issuing_country: v } : d) } : p); }} />
              <div className="flex gap-2">
                <input type="date" className={inputCls} value={doc.issue_date?.split('T')[0] || ''} onChange={e => updateIdentityDoc(doc.id, { ...doc, issue_date: e.target.value })} />
                <input type="date" className={inputCls} value={doc.expire_date?.split('T')[0] || ''} onChange={e => updateIdentityDoc(doc.id, { ...doc, expire_date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              {doc.expire_date && new Date(doc.expire_date) < new Date() && (
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Expired</span>
              )}
              {isOwnProfile && <button onClick={() => deleteIdentityDoc(doc.id)} className="text-red-600 hover:underline text-xs">{t('admin.delete')}</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Key-Value Attributes (AHV, tax number, etc.) */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-sm text-gray-500 uppercase">{t('profile.attributes')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.ahvNumber')}</label>
            <input className={inputCls} value={attrMap.ahv_number || ''} onBlur={e => saveAttributes({ ...attrMap, ahv_number: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => { if (!p) return p; const attrs = p.attributes.filter(a => a.attribute_name !== 'ahv_number'); if (v) attrs.push({ id: 0, attribute_name: 'ahv_number', attribute_value: v }); return { ...p, attributes: attrs }; }); }} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.taxNumber')}</label>
            <input className={inputCls} value={attrMap.tax_number || ''} onBlur={e => saveAttributes({ ...attrMap, tax_number: e.target.value })} onChange={e => { const v = e.target.value; setProfile(p => { if (!p) return p; const attrs = p.attributes.filter(a => a.attribute_name !== 'tax_number'); if (v) attrs.push({ id: 0, attribute_name: 'tax_number', attribute_value: v }); return { ...p, attributes: attrs }; }); }} />
          </div>
        </div>
      </div>
    </div>
  );
}
