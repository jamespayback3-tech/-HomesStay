/* DerickStay frontend. Requires config.js with Supabase URL and anon/publishable key. */
const cfg = window.DERICKSTAY_CONFIG || {};
const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("YOUR_");
const sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let currentUser = null, authMode = "signup", pendingPhotos = [];
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");
const msg = (id, text) => { $(id).textContent = text; };
const toast = text => { $("toast").textContent=text; $("toast").style.display="block"; setTimeout(()=>$("toast").style.display="none",3500); };
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const words = s => (s.trim().match(/\S+/g)||[]).length;
function requireConfig(){ if(!sb){toast("Connect Supabase first: copy config.js.example to config.js and add your project URL and anon key.");return false;}return true; }
function openAuth(mode){authMode=mode; $("authTitle").textContent=mode==="signup"?"Create your account":"Welcome back";$("authSubmit").textContent=mode==="signup"?"Create account":"Sign in";$("switchText").textContent=mode==="signup"?"Already have an account?":"New to DerickStay?";$("switchAuth").textContent=mode==="signup"?"Sign in":"Create account";msg("authMessage","");show("authModal");}
$("openAuth").onclick=()=>openAuth("login");$("openRegister").onclick=()=>openAuth("signup");
$("switchAuth").onclick=()=>openAuth(authMode==="signup"?"login":"signup");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal").classList.add("hidden"));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
$("year").textContent=new Date().getFullYear();
$("authForm").onsubmit=async e=>{e.preventDefault();if(!requireConfig())return;const email=$("authEmail").value.trim(),password=$("authPassword").value; $("authSubmit").disabled=true;
 try{if(authMode==="signup"){const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;msg("authMessage","Account created. Check your email and click the confirmation link before signing in.");}
 else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;hide("authModal");toast("Signed in successfully.");}
 }catch(err){msg("authMessage",err.message||"Something went wrong.");}finally{$("authSubmit").disabled=false;}};
$("signOut").onclick=async()=>{await sb.auth.signOut();toast("Signed out.");};
async function refreshSession(){if(!sb)return;const {data}=await sb.auth.getSession();currentUser=data.session?.user||null;updateNav();if(currentUser)await ensureProfile();await loadProperties();}
function updateNav(){$("openAuth").classList.toggle("hidden",!!currentUser);$("openRegister").classList.toggle("hidden",!!currentUser);$("signOut").classList.toggle("hidden",!currentUser);$("accountBtn")?.classList.toggle("hidden",!currentUser);$("listProperty").textContent=currentUser?"＋ List your property":"Sign in to list a property";}
async function ensureProfile(){const {error}=await sb.from("profiles").upsert({id:currentUser.id,email:currentUser.email},{onConflict:"id",ignoreDuplicates:true});if(error)console.warn(error);}
async function loadProperties(){if(!sb){$("propertyGrid").innerHTML='<div class="empty">Connect your Supabase project to publish and browse live listings. Follow SETUP.md.</div>';return;}
 let q=sb.from("properties").select("*,profiles(display_name,avatar_url)").eq("status","published").order("created_at",{ascending:false});
 const search=$("searchInput").value.trim();if(search)q=q.or(`title.ilike.%${search}%,location.ilike.%${search}%,description.ilike.%${search}%`);
 if($("typeFilter").value)q=q.eq("property_type",$("typeFilter").value);
 const {data,error}=await q.limit(60);if(error){$("propertyGrid").innerHTML=`<div class="empty">${esc(error.message)}</div>`;return;}
 if(!data?.length){$("propertyGrid").innerHTML='<div class="empty">No properties found yet. Be the first to list a property.</div>';return;}
 $("propertyGrid").innerHTML=data.map(p=>{const photo=p.photo_urls?.[0];return `<article class="property-card"><div class="property-image">${photo?`<img src="${esc(photo)}" alt="${esc(p.title)}">`:"Property photos will appear here"}</div><div class="property-body"><h3>${esc(p.title)}</h3><div class="muted">${esc(p.property_type)} · ${esc(p.location)}</div><div class="price">KES ${Number(p.monthly_rent).toLocaleString("en-KE")} <small class="muted">/ month</small></div><p class="muted">${esc((p.description||"").slice(0,110))}${p.description?.length>110?"…":""}</p><div class="owner-row"><img src="${esc(p.profiles?.avatar_url||"assets/avatar.svg")}" alt=""><span class="muted">${esc(p.profiles?.display_name||"Property owner")}</span></div><div class="card-actions"><button class="small-btn" onclick="viewProperty('${p.id}')">View details</button><button class="small-btn" onclick="viewProfile('${p.owner_id}')">Owner profile</button></div></div></article>`}).join("");
}
$("searchBtn").onclick=loadProperties;$("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")loadProperties()});$("typeFilter").onchange=loadProperties;
$("listProperty").onclick=()=>{if(!currentUser){openAuth("signup");return;}openListing();};
async function screenImage(file){ // AI screening runs server-side; without the deployed function, fail closed for profile/listing uploads.
 const {data,error}=await sb.functions.invoke("screen-image",{body:{filename:file.name,mime_type:file.type,image_base64:await fileToBase64(file)}});
 if(error)throw new Error("Image screening is not configured or unavailable. Please try again later.");
 if(data?.decision==="reject")throw new Error("Image rejected by AI screening: "+(data.reason||"suspected AI-generated image"));
 if(data?.decision!=="approve")throw new Error("Image could not be verified. Please use a clear original photograph.");
 return true;
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(file);});}
function validImage(f){return ["image/jpeg","image/png","image/webp"].includes(f.type)&&f.size<=8*1024*1024;}
$("bio").addEventListener("input",()=>{$("bioCount").textContent=`${words($("bio").value)} / 177 words`;if(words($("bio").value)>177)$("bioCount").style.color="red";else $("bioCount").style.color="";});
$("editProfile").onclick=()=>{hide("dashboardModal");openProfile();};
async function openProfile(){if(!currentUser){openAuth("login");return;}const {data}=await sb.from("profiles").select("*").eq("id",currentUser.id).single();$("displayName").value=data?.display_name||"";$("bio").value=data?.bio||"";$("bioCount").textContent=`${words($("bio").value)} / 177 words`;show("profileModal");}
$("profileForm").onsubmit=async e=>{e.preventDefault();if(!requireConfig())return;const bio=$("bio").value.trim();if(words(bio)>177){msg("profileMessage","Bio must be 177 words or fewer.");return;}let avatar_url;
 const f=$("avatarFile").files[0];try{if(f){if(!validImage(f))throw new Error("Use JPG, PNG or WebP under 8 MB.");await screenImage(f);const path=`${currentUser.id}/avatar-${Date.now()}.${f.type.split("/")[1]}`;const up=await sb.storage.from("avatars").upload(path,f,{upsert:true,contentType:f.type});if(up.error)throw up.error;avatar_url=sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;}
 const patch={id:currentUser.id,email:currentUser.email,display_name:$("displayName").value.trim(),bio};if(avatar_url)patch.avatar_url=avatar_url;const {error}=await sb.from("profiles").upsert(patch);if(error)throw error;hide("profileModal");toast("Profile saved.");}catch(err){msg("profileMessage",err.message||"Could not save profile.");}};
function openListing(p){$("listingForm").reset();$("listingId").value=p?.id||"";$("listingTitle").textContent=p?"Edit property":"Add a property";$("propertyTitle").value=p?.title||"";$("propertyType").value=p?.property_type||"House";$("propertyLocation").value=p?.location||"";$("propertyPrice").value=p?.monthly_rent||"";$("propertyDescription").value=p?.description||"";pendingPhotos=p?.photo_urls||[];renderPreview();msg("listingMessage","");show("listingModal");}
$("propertyPhotos").onchange=()=>{const files=[...$("propertyPhotos").files];if(files.length+pendingPhotos.length>7){msg("listingMessage","Maximum seven photos per property.");$("propertyPhotos").value="";return;}if(files.some(f=>!validImage(f))){msg("listingMessage","Use JPG, PNG or WebP images under 8 MB each.");$("propertyPhotos").value="";return;}renderPreview(files);};
function renderPreview(files=[]){$("photoPreview").innerHTML=[...pendingPhotos.map(u=>`<img src="${esc(u)}" alt="Existing property photo">`),...files.map(f=>`<img src="${URL.createObjectURL(f)}" alt="Selected photo">`)].join("");}
$("listingForm").onsubmit=async e=>{e.preventDefault();if(!requireConfig())return;const id=$("listingId").value;const files=[...$("propertyPhotos").files];if(files.length+pendingPhotos.length>7){msg("listingMessage","Maximum seven photos per property.");return;}
 try{let urls=[...pendingPhotos];for(const f of files){await screenImage(f);const path=`${currentUser.id}/${crypto.randomUUID()}.${f.type.split("/")[1]}`;const up=await sb.storage.from("property-photos").upload(path,f,{contentType:f.type});if(up.error)throw up.error;urls.push(sb.storage.from("property-photos").getPublicUrl(path).data.publicUrl);}
 const payload={owner_id:currentUser.id,title:$("propertyTitle").value.trim(),property_type:$("propertyType").value,location:$("propertyLocation").value.trim(),monthly_rent:Number($("propertyPrice").value),description:$("propertyDescription").value.trim(),photo_urls:urls,status:"published"};
 let result=id?await sb.from("properties").update(payload).eq("id",id).eq("owner_id",currentUser.id):await sb.from("properties").insert(payload);if(result.error)throw result.error;hide("listingModal");toast("Property saved and published.");await loadProperties();
 }catch(err){msg("listingMessage",err.message||"Could not publish property.");}};
window.viewProperty=async id=>{const {data:p,error}=await sb.from("properties").select("*,profiles(display_name,avatar_url,bio)").eq("id",id).single();if(error){toast(error.message);return;}if(currentUser&&currentUser.id!==p.owner_id){await sb.from("notifications").insert({recipient_id:p.owner_id,actor_id:currentUser.id,type:"listing_view",message:"Someone viewed your property: "+p.title,entity_id:p.id});}
 const photos=(p.photo_urls||[]).map(u=>`<img src="${esc(u)}" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;margin:4px 0">`).join("");$("profileViewContent").innerHTML=`<p class="eyebrow">${esc(p.property_type)} · ${esc(p.location)}</p><h2>${esc(p.title)}</h2>${photos}<h3 class="price">KES ${Number(p.monthly_rent).toLocaleString("en-KE")} / month</h3><p>${esc(p.description)}</p><button class="btn btn-outline" onclick="viewProfile('${p.owner_id}')">View owner profile</button>`;show("profileViewModal");};
window.viewProfile=async id=>{if(!sb)return;const {data:p,error}=await sb.from("profiles").select("*").eq("id",id).single();if(error){toast(error.message);return;}if(currentUser&&currentUser.id!==id){const {error:nerr}=await sb.from("notifications").insert({recipient_id:id,actor_id:currentUser.id,type:"profile_view",message:"Someone viewed your profile"});if(nerr)console.warn(nerr);}
 $("profileViewContent").innerHTML=`<div class="profile-row"><img class="avatar" src="${esc(p.avatar_url||"assets/avatar.svg")}"><div><h2>${esc(p.display_name||"DerickStay member")}</h2><p class="muted">${esc(p.email||"")}</p></div></div><p>${esc(p.bio||"This member has not added a bio yet.")}</p>`;show("profileViewModal");};
$("dashboardModal").addEventListener("show",()=>{});
async function openDashboard(){if(!currentUser){openAuth("login");return;}const [{data:props},{data:notices}]=await Promise.all([sb.from("properties").select("*").eq("owner_id",currentUser.id).order("created_at",{ascending:false}),sb.from("notifications").select("*").eq("recipient_id",currentUser.id).order("created_at",{ascending:false}).limit(20)]);$("dashboardContent").innerHTML=`<h3>Your properties</h3>${(props||[]).map(p=>`<div class="notice"><b>${esc(p.title)}</b> · ${esc(p.status)}<br><button class="small-btn" onclick="editProperty('${p.id}')">Edit listing</button></div>`).join("")||"<p class='muted'>You have not listed a property yet.</p>"}<h3>Notifications</h3>${(notices||[]).map(n=>`<div class="notice">${esc(n.message)} <small class="muted">${new Date(n.created_at).toLocaleString()}</small></div>`).join("")||"<p class='muted'>No notifications yet.</p>"}`;show("dashboardModal");}
window.editProperty=async id=>{const {data,error}=await sb.from("properties").select("*").eq("id",id).eq("owner_id",currentUser.id).single();if(error){toast(error.message);return;}hide("dashboardModal");openListing(data);};
$("openRegister").addEventListener("contextmenu",e=>e.preventDefault());
$("brand")?.addEventListener("click",openDashboard);
$("listProperty").addEventListener("contextmenu",e=>{e.preventDefault();openDashboard();});
$("signOut").insertAdjacentHTML("afterend",'<button id="accountBtn" class="btn btn-outline hidden">My account</button>');
$("accountBtn").onclick=openDashboard;
if(sb){sb.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;updateNav();if(currentUser)ensureProfile();loadProperties();});refreshSession();}
else{updateNav();loadProperties();}
