import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { LABELS } from "@/data/workspace";
import { Initials, PageHeader, Panel, Tag } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, FileText, Loader2, Github, Mail, Phone, Shield, Eye, ExternalLink, Linkedin } from "lucide-react";
import { uploadFile } from "@/lib/uploads";
import { formatLinkedinUrl, getLinkedinUsername } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/data/workspace";
import { sendTestEmailServer } from "@/lib/db-server";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Project Settings — ResearchHub" },
      { name: "description", content: "Manage members, roles, research phases, categories, labels, permissions and project data export." },
      { property: "og:title", content: "Project Settings — ResearchHub" },
      { property: "og:description", content: "Admin controls for the research workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const ws = useWorkspace();
  const [activeTab, setActiveTab] = useState("profile");
  
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [institution, setInstitution] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileUniId, setProfileUniId] = useState("");
  const [profileUniEmail, setProfileUniEmail] = useState("");
  const [profilePrivateEmail, setProfilePrivateEmail] = useState("");
  const [profileGithubUsername, setProfileGithubUsername] = useState("");
  const [profileLinkedinUrl, setProfileLinkedinUrl] = useState("");
  const [profileResponsibilities, setProfileResponsibilities] = useState("");
  const [profileCv, setProfileCv] = useState("");
  const [profileCvStoragePath, setProfileCvStoragePath] = useState("");
  const [profileCvMimeType, setProfileCvMimeType] = useState("");
  const [profileCvSizeBytes, setProfileCvSizeBytes] = useState<number | undefined>(undefined);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [viewMember, setViewMember] = useState<Member | null>(null);

  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Sync inputs with workspace context values
  useEffect(() => {
    setName(ws.project.name);
    setTopic(ws.project.topic);
    setInstitution(ws.project.institution);
  }, [ws.project]);

  // Sync inputs with user context values
  useEffect(() => {
    if (ws.currentUser) {
      setProfileName(ws.currentUser.name || "");
      setProfilePhone(ws.currentUser.phone || "");
      setProfileUniId(ws.currentUser.uniId || "");
      setProfileUniEmail(ws.currentUser.uniEmail || "");
      setProfilePrivateEmail(ws.currentUser.privateEmail || "");
      setProfileGithubUsername(ws.currentUser.githubUsername || "");
      setProfileLinkedinUrl(ws.currentUser.linkedinUrl || "");
      setProfileResponsibilities(ws.currentUser.responsibilities || "");
      setProfileCv(ws.currentUser.cv || "");
      setProfileCvStoragePath(ws.currentUser.cv_storage_path || "");
      setProfileCvMimeType(ws.currentUser.cv_mime_type || "");
      setProfileCvSizeBytes(ws.currentUser.cv_size_bytes);
      setTestEmailAddress(ws.currentUser.email || "");
    }
  }, [ws.currentUser]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Project name cannot be empty.");
      return;
    }
    ws.updateProject(name, topic, institution);
    toast.success("Project settings saved successfully!");
  };

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    const toastId = toast.loading(`Uploading CV "${file.name}"...`);
    try {
      const uploadRes = await uploadFile(file, file.name, "cvs");
      setProfileCv(uploadRes.url);
      setProfileCvStoragePath(uploadRes.storage_path);
      setProfileCvMimeType(uploadRes.mime_type);
      setProfileCvSizeBytes(uploadRes.size_bytes);
      toast.success("CV uploaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload CV.", { id: toastId });
    } finally {
      setUploadingCv(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!ws.currentUser) return;
    if (!profileName.trim()) {
      toast.error("Profile name cannot be empty.");
      return;
    }
    await ws.updateProfile(ws.currentUser.id, {
      name: profileName.trim(),
      phone: profilePhone.trim() || undefined,
      uniId: profileUniId.trim() || undefined,
      uniEmail: profileUniEmail.trim() || undefined,
      privateEmail: profilePrivateEmail.trim() || undefined,
      githubUsername: profileGithubUsername.trim() || undefined,
      linkedinUrl: profileLinkedinUrl.trim() || undefined,
      responsibilities: profileResponsibilities.trim(),
      cv: profileCv || undefined,
      cv_storage_path: profileCvStoragePath || undefined,
      cv_mime_type: profileCvMimeType || undefined,
      cv_size_bytes: profileCvSizeBytes || undefined,
    });
    toast.success("Profile saved successfully!");
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      toast.error("Please enter a recipient email address.");
      return;
    }
    setSendingTestEmail(true);
    const toastId = toast.loading("Sending test email...");
    try {
      const res = await sendTestEmailServer({ data: testEmailAddress.trim() });
      if (res.success) {
        toast.success("Test email dispatched successfully! Check your inbox or server logs.", { id: toastId });
      } else {
        toast.error(`Failed to send email: ${res.error || "Unknown error"}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Error sending test email: ${err.message || String(err)}`, { id: toastId });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const dynamicTags = Array.from(
    new Set([
      ...ws.notes.flatMap((n) => n.tags || []),
      ...ws.shots.flatMap((s) => s.tags || []),
      ...ws.links.flatMap((l) => l.tags || []),
      ...ws.papers.flatMap((p) => p.keywords || []),
    ])
  )
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Project Settings" subtitle="Admin controls for the research workspace" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* User Profile panel */}
            {ws.currentUser && (
              <Panel className="p-5">
                <h2 className="font-display text-sm font-semibold">My Profile</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Edit your personal registration details</p>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Full Name</Label>
                      <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Phone Number</Label>
                      <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="e.g. +20 123 456 7890" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">University ID</Label>
                      <Input value={profileUniId} onChange={(e) => setProfileUniId(e.target.value)} placeholder="e.g. 2026-102948" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">University Email</Label>
                      <Input value={profileUniEmail} onChange={(e) => setProfileUniEmail(e.target.value)} placeholder="e.g. name@uni.edu" />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Private Email</Label>
                    <Input value={profilePrivateEmail} onChange={(e) => setProfilePrivateEmail(e.target.value)} placeholder="e.g. personal@gmail.com" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">GitHub Username</Label>
                      <Input value={profileGithubUsername} onChange={(e) => setProfileGithubUsername(e.target.value)} placeholder="e.g. octocat" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">LinkedIn Profile URL</Label>
                      <Input value={profileLinkedinUrl} onChange={(e) => setProfileLinkedinUrl(e.target.value)} placeholder="e.g. https://linkedin.com/in/username" />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Research Responsibilities</Label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
                      value={profileResponsibilities}
                      onChange={(e) => setProfileResponsibilities(e.target.value)}
                      placeholder="Describe your role and focus areas..."
                    />
                  </div>
                  {ws.currentUser.role === "Member" && (
                    <div className="pt-2 space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-brand" />
                        CV Document / Resume
                      </Label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-xl bg-muted/30 text-xs font-semibold text-foreground hover:bg-secondary transition-all cursor-pointer flex-1">
                          {uploadingCv ? (
                            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate max-w-[250px] text-muted-foreground">
                            {profileCv ? (
                              profileCv.startsWith("http") ? "CV Document uploaded" : profileCv
                            ) : "Select CV File (PDF, DOCX...)"}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={handleCvChange}
                            className="hidden"
                            disabled={uploadingCv}
                          />
                        </label>
                        {profileCvStoragePath && (
                          <a
                            href={
                              supabase.storage
                                .from("documents")
                                .getPublicUrl(profileCvStoragePath).data.publicUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-brand hover:underline shrink-0"
                          >
                            View Current
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  <Button className="w-fit" onClick={handleSaveProfile} disabled={uploadingCv}>Save profile</Button>
                </div>
              </Panel>
            )}

            {/* Theme Settings panel */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold">Theme Preferences</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Customize your interface theme and layout density</p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Dark Mode</span>
                    <p className="text-[11px] text-muted-foreground">Switch between light and dark themes</p>
                  </div>
                  <Switch 
                    checked={ws.theme === "dark"} 
                    onCheckedChange={() => {
                      ws.toggleTheme();
                      toast.success(`Switched to ${ws.theme === "light" ? "dark" : "light"} mode`);
                    }} 
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Dark Scheme Accent</Label>
                  <select 
                    className="w-full h-10 px-3 border border-border rounded-xl bg-card text-sm cursor-pointer"
                    value={ws.darkAccent}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      ws.setDarkAccent(val);
                      toast.success(`Dark scheme set to ${val}`);
                    }}
                  >
                    <option value="slate">Slate Blue (Modern Slate)</option>
                    <option value="black">Jet Black (OLED Friendly)</option>
                    <option value="emerald">Emerald Green (Matrix vibe)</option>
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Sidebar Layout Density</Label>
                  <select 
                    className="w-full h-10 px-3 border border-border rounded-xl bg-card text-sm cursor-pointer"
                    value={ws.sidebarDensity}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      ws.setSidebarDensity(val);
                      toast.success(`Sidebar density set to ${val}`);
                    }}
                  >
                    <option value="relaxed">Relaxed / Default spacing</option>
                    <option value="compact">Compact / List view</option>
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Aesthetic Panels Effect</Label>
                  <select 
                    className="w-full h-10 px-3 border border-border rounded-xl bg-card text-sm cursor-pointer"
                    value={ws.panelEffect}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      ws.setPanelEffect(val);
                      toast.success(`Aesthetic effect set to ${val}`);
                    }}
                  >
                    <option value="glass">Glassmorphism / Frosted Panels</option>
                    <option value="solid">Minimalist / Solid Flat Colors</option>
                  </select>
                </div>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="workspace">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Project Profile panel */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold">Project Details</h2>
              <div className="mt-3 grid gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Project name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Research topic</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Institution</Label>
                  <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
                </div>
                <Button className="w-fit" onClick={handleSave}>Save changes</Button>
              </div>

              <div className="mt-8 pt-6 border-t border-destructive/20 space-y-3">
                <h3 className="text-xs font-bold text-destructive uppercase tracking-wider">Danger Zone</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Permanently delete all papers, tasks, chat messages, meetings, voice notes, and screenshots, and reset the project to start fresh. This action is irreversible.
                </p>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={async () => {
                    if (confirm("WARNING: Are you absolutely sure you want to permanently clear all data and start fresh? All papers, tasks, comments, and chat messages will be deleted forever.")) {
                      try {
                        const toastId = toast.loading("Clearing all workspace data...");
                        await ws.clearAllData();
                        toast.success("Workspace reset to clean state!", { id: toastId });
                      } catch (err) {
                        toast.error("Failed to clear data.");
                      }
                    }
                  }}
                  className="cursor-pointer font-bold text-xs"
                >
                  Clear All Data
                </Button>
              </div>
            </Panel>

            {/* Roster & Members Panel */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold">Members & roles</h2>
              <ul className="mt-3 space-y-2">
                {ws.members.length > 0 ? (
                  ws.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                      <Initials member={m} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
                      <Tag>{m.role}</Tag>
                      {m.id === ws.currentUser?.id ? (
                        <>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setActiveTab("profile")}
                            className="cursor-pointer font-semibold text-brand hover:bg-brand/10"
                          >
                            Manage
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to permanently delete your account and leave the workspace?`)) {
                                await ws.deleteMember(m.id);
                                ws.logoutUser();
                                toast.success(`Your account has been deleted`);
                              }
                            }}
                          >
                            Delete Account
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setViewMember(m)}
                          className="cursor-pointer font-semibold text-brand hover:bg-brand/10"
                        >
                          View Profile
                        </Button>
                      )}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-2">No team members registered yet.</p>
                )}
              </ul>
            </Panel>

            {/* Research phrases & labels */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold">Research phrases & labels</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Dynamic keywords and tags aggregated from papers, notes, screenshots, and links. Click any to search.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dynamicTags.length > 0 ? (
                  dynamicTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        ws.setSearchQuery(tag);
                        ws.setSearchOpen(true);
                      }}
                      className="rounded-full bg-brand/5 border border-brand/20 px-2.5 py-1 text-xs text-brand hover:bg-brand/10 transition-colors font-medium cursor-pointer"
                    >
                      #{tag}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No tags or keywords added yet.</span>
                )}
              </div>
            </Panel>

            {/* Permissions & data */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold">Permissions & data</h2>
              <div className="mt-3 space-y-3">
                <Toggle 
                  label="Email deadline reminders" 
                  checked={ws.preferences.emailReminders} 
                  onCheckedChange={(val) => {
                    ws.updatePreference("emailReminders", val);
                    toast.success("Preference updated");
                  }}
                />
              </div>
            </Panel>

            {/* Email Notification Integration */}
            <Panel className="p-5">
              <h2 className="font-display text-sm font-semibold flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-brand" />
                Email Notification Integration
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Send a test notification to verify that Gemini API formatting, Resend, or SMTP email drivers are functional.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Recipient Email Address</Label>
                  <Input 
                    type="email" 
                    placeholder="e.g. name@example.com" 
                    value={testEmailAddress} 
                    onChange={(e) => setTestEmailAddress(e.target.value)} 
                  />
                </div>
                <Button 
                  onClick={handleSendTestEmail} 
                  disabled={sendingTestEmail}
                  className="flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  {sendingTestEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending test email...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      {/* View teammate profile dialog */}
      <Dialog open={Boolean(viewMember)} onOpenChange={(open) => !open && setViewMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teammate Profile Workspace</DialogTitle>
          </DialogHeader>
          {viewMember && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5 pb-4 border-b border-border/50">
                <div className="h-14 w-14 rounded-full flex items-center justify-center font-bold text-xl uppercase border shadow-md"
                     style={{
                       backgroundColor: `${viewMember.color}15`,
                       color: viewMember.color,
                       borderColor: `${viewMember.color}35`,
                     }}
                >
                  {viewMember.initials}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground leading-tight">{viewMember.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      <Shield className="h-3 w-3" />
                      {viewMember.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {viewMember.responsibilities && (
                  <div>
                    <span className="font-bold text-muted-foreground block mb-1">Responsibilities</span>
                    <p className="text-foreground/90 bg-muted/40 p-2.5 rounded-xl border border-border/40 leading-relaxed">
                      {viewMember.responsibilities}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {viewMember.uniId && (
                    <div>
                      <span className="font-bold text-muted-foreground block mb-0.5">University ID</span>
                      <span className="font-semibold text-foreground">{viewMember.uniId}</span>
                    </div>
                  )}
                  {viewMember.phone && (
                    <div>
                      <span className="font-bold text-muted-foreground block mb-0.5">Phone Number</span>
                      <a href={`tel:${viewMember.phone}`} className="font-semibold text-brand hover:underline flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {viewMember.phone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-muted-foreground">Primary Login Email</span>
                    <a href={`mailto:${viewMember.email}`} className="font-semibold text-brand hover:underline flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {viewMember.email}
                    </a>
                  </div>
                  {viewMember.uniEmail && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-muted-foreground">University Email</span>
                      <a href={`mailto:${viewMember.uniEmail}`} className="font-semibold text-brand hover:underline flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {viewMember.uniEmail}
                      </a>
                    </div>
                  )}
                  {viewMember.privateEmail && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-muted-foreground">Private Email</span>
                      <a href={`mailto:${viewMember.privateEmail}`} className="font-semibold text-brand hover:underline flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {viewMember.privateEmail}
                      </a>
                    </div>
                  )}
                  {viewMember.githubUsername && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-muted-foreground">GitHub Profile</span>
                      <a 
                        href={`https://github.com/${viewMember.githubUsername}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-semibold text-brand hover:underline flex items-center gap-1"
                      >
                        <Github className="h-3.5 w-3.5" /> @{viewMember.githubUsername}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {viewMember.linkedinUrl && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-muted-foreground">LinkedIn Profile</span>
                      <a 
                        href={formatLinkedinUrl(viewMember.linkedinUrl)} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-semibold text-brand hover:underline flex items-center gap-1"
                      >
                        <Linkedin className="h-3.5 w-3.5" /> @{getLinkedinUsername(viewMember.linkedinUrl)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {viewMember.cv && (
                  <div className="pt-3 border-t border-border/40">
                    <span className="font-bold text-muted-foreground block mb-2">CV / Resume Document</span>
                    <a 
                      href={viewMember.cv}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs font-bold text-brand hover:bg-brand/10 transition-colors w-full justify-center"
                    >
                      <FileText className="h-4 w-4" />
                      Download Teammate CV
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ 
  label, 
  checked, 
  onCheckedChange 
}: { 
  label: string; 
  checked: boolean; 
  onCheckedChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}