import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import { groupsApi, normativesApi, exportApi, categoriesApi, usersApi, rankingsApi, monitoringApi } from '@/api';
import { Loader2, ArrowLeft, Download, Users, Target, Star, Medal, UserPlus, Trash2, PlusCircle, CheckCircle, Search, GraduationCap, Brain } from 'lucide-react';
import ScoreBadge from '@/components/shared/ScoreBadge';
import { downloadBlob } from '@/utils';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [rankData, setRankData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Student management states
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [savingStudents, setSavingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [ungroupedStudents, setUngroupedStudents] = useState<any[]>([]);

  // Normative management states
  const [showNormativeModal, setShowNormativeModal] = useState(false);
  const [allNormatives, setAllNormatives] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedNormativeIds, setSelectedNormativeIds] = useState<string[]>([]);
  const [savingNormatives, setSavingNormatives] = useState(false);

  // AI Group Analysis states
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleAiAnalyze = async () => {
    if (!id) return;
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    try {
      const res = await monitoringApi.analyzeGroup(id);
      setAiResult(res.data.data?.analysis || '');
    } catch (e: any) {
      const err = e?.response?.data?.error;
      if (err === 'API_KEY_NOT_SET') setAiError('api_key');
      else if (err === 'NO_DATA') setAiError('no_data');
      else setAiError('connection');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchGroupData = async () => {
    if (!id) return;
    try {
      const [groupRes, rankRes] = await Promise.all([
        groupsApi.getById(id),
        rankingsApi.getGroupRanking(id).catch(() => null)
      ]);
      setGroup(groupRes.data.data);
      if (rankRes) setRankData(rankRes.data.data);
      
      // Initialize selected students from current group
      const currentStudentIds = (groupRes.data.data.students || []).map((s: any) => s.id);
      setSelectedStudentIds(currentStudentIds);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  const handleOpenStudentModal = async () => {
    try {
      const [allRes, ungroupedRes] = await Promise.all([
        usersApi.getAll(1, 1000, 'student'),
        usersApi.getUngrouped()
      ]);
      setAllStudents(allRes.data.data || []);
      setUngroupedStudents(ungroupedRes.data.data || []);
      setStudentSearch('');
      setShowStudentModal(true);
    } catch (err) {
      console.error(err);
      alert("O'quvchilarni yuklashda xatolik");
    }
  };

  const handleSaveStudents = async () => {
    if (!id) return;
    setSavingStudents(true);
    try {
      // Get current student IDs in group
      const currentIds = (group?.students || []).map((s: any) => s.id);
      
      // Find new students to add
      const toAdd = selectedStudentIds.filter(sid => !currentIds.includes(sid));
      // Find students to remove
      const toRemove = currentIds.filter((sid: string) => !selectedStudentIds.includes(sid));
      
      // Add new students
      if (toAdd.length > 0) {
        await groupsApi.addStudentsBulk(id, toAdd);
      }
      
      // Remove deselected students
      for (const sid of toRemove) {
        await groupsApi.removeStudent(id, sid);
      }
      
      setShowStudentModal(false);
      fetchGroupData();
    } catch (err) {
      console.error(err);
      alert("O'quvchilarni saqlashda xatolik yuz berdi");
    } finally {
      setSavingStudents(false);
    }
  };

  const handleOpenNormativeModal = async () => {
    try {
      const [normRes, catRes] = await Promise.all([
        normativesApi.getAll(1, 1000),
        categoriesApi.getAll()
      ]);
      setAllNormatives(normRes.data.data || []);
      setCategories(catRes.data.data || []);
      
      const currentIds = (group?.normatives || []).map((n: any) => n.normativeId || n.id);
      setSelectedNormativeIds(currentIds);
      setSelectedCategoryId('all');
      
      setShowNormativeModal(true);
    } catch (err) {
      console.error(err);
      alert("Normativlarni yuklashda xatolik");
    }
  };

  const handleSelectCategoryAll = () => {
    const unassignedInCategory = allNormatives.filter(norm => {
      const isAssigned = (group?.normatives || []).some((n: any) => (n.normativeId || n.id) === norm.id);
      const matchCategory = selectedCategoryId === 'all' || norm.categoryId === selectedCategoryId;
      return !isAssigned && matchCategory;
    });
    
    const idsToAdd = unassignedInCategory.map(n => n.id);
    const newSelected = [...new Set([...selectedNormativeIds, ...idsToAdd])];
    setSelectedNormativeIds(newSelected);
  };

  const handleSaveNormatives = async () => {
    if (!id) return;
    setSavingNormatives(true);
    try {
      const currentIds = (group?.normatives || []).map((n: any) => n.normativeId || n.id);
      const toAdd = selectedNormativeIds.filter(nid => !currentIds.includes(nid));
      
      if (toAdd.length > 0) {
        await groupsApi.assignNormatives(id, toAdd);
      }
      
      setShowNormativeModal(false);
      fetchGroupData();
    } catch (err) {
      console.error(err);
      alert("Normativlarni saqlashda xatolik yuz berdi");
    } finally {
      setSavingNormatives(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!id) return;
    if (!confirm("O'quvchini guruhdan chiqarishni xohlaysizmi?")) return;
    try {
      await groupsApi.removeStudent(id, studentId);
      fetchGroupData();
    } catch (err) {
      console.error(err);
      alert("O'chirishda xatolik yuz berdi");
    }
  };

  const handleExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const res = await exportApi.exportGroup(id);
      downloadBlob(res.data, `guruh_${group?.name || id}_natijalari.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Eksport qilishda xatolik");
    } finally {
      setExporting(false);
    }
  };

  const goBack = () => {
    if (user?.role === 'admin') navigate('/admin/groups');
    else navigate('/teacher/groups');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const students = group?.students || [];
  const normatives = group?.normatives || [];

  return (
    <div>
      <Header 
        title={`${group?.name || ''} Guruhi`} 
        subtitle={`${students.length} o'quvchi | ${normatives.length} normativ`} 
      />

      {/* Teacher badge */}
      <div className="px-8 pt-4 max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18181b] border border-zinc-800 text-sm">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          <span className="text-zinc-400">O'qituvchi:</span>
          {group?.teacher ? (
            <span className="text-white font-medium">{group.teacher.fullName}</span>
          ) : (
            <span className="text-zinc-500 italic">Biriktirilmagan</span>
          )}
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Top Actions */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={goBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Guruhlar
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleOpenNormativeModal}
              className="bg-[#18181b] hover:bg-zinc-800 text-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              Normativ
            </button>
            <button 
              onClick={handleOpenStudentModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              O'quvchi qo'shish
            </button>
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="bg-[#18181b] hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-zinc-800"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Yuklanmoqda...' : 'Eksport'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">O'quvchilar</p>
              <p className="text-2xl font-bold text-white tracking-tight">{students.length}</p>
            </div>
          </div>
          
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Target className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Normativlar</p>
              <p className="text-2xl font-bold text-white tracking-tight">{normatives.length}</p>
            </div>
          </div>
          
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Star className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Topshiriqlar</p>
              <p className="text-2xl font-bold text-white tracking-tight">{group?.submissionsCount || 0}</p>
            </div>
          </div>
        </div>

        {/* AI Group Analysis */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden mb-8">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-[#18181b]">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-violet-400" />
              <div>
                <h3 className="text-white font-bold text-sm">AI Guruh Tahlili</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Muammolar, ortda qolayotganlar va guruh faoliyati tahlili</p>
              </div>
            </div>
            <button
              onClick={handleAiAnalyze}
              disabled={aiLoading}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Tahlil qilinmoqda...
                </>
              ) : (
                'Tahlil qilish'
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-5 border-b border-zinc-800/50 bg-red-500/5 text-red-400 text-xs">
              {aiError === 'api_key' ? (
                "⚠️ Sozlamalarda AI API kaliti aniqlanmagan. Iltimos, Sozlamalar sahifasiga o'ting."
              ) : aiError === 'no_data' ? (
                "ℹ️ Ushbu guruhda AI tahlil o'tkazish uchun yetarli ma'lumot (monitoring qo'ng'iroqlari yoki normativ topshiriqlari) mavjud emas."
              ) : (
                "❌ AI tahlilni generatsiya qilishda xatolik yuz berdi. Provayder API kalitini tekshiring yoki keyinroq qayta urining."
              )}
            </div>
          )}

          {aiResult && (
            <div 
              className="p-6 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap bg-[#09090b]/40 divide-y divide-zinc-800"
              style={{ maxHeight: '480px', overflowY: 'scroll' }}
            >
              {aiResult}
            </div>
          )}
        </div>

        {/* Students Table */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm mb-8">
          <div className="p-5 border-b border-zinc-800 bg-[#18181b]">
            <h3 className="text-base font-bold text-white tracking-tight">O'quvchilar ro'yxati</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">N</th>
                  <th className="px-6 py-4">O'quvchi</th>
                  <th className="px-6 py-4">Login</th>
                  <th className="px-6 py-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                      Guruhda hali o'quvchi yo'q. "O'quvchi qo'shish" tugmasini bosing.
                    </td>
                  </tr>
                ) : (
                  students.map((student: any, idx: number) => (
                    <tr key={student.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-zinc-500">{idx + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-blue-500 border border-blue-500/20">
                            {student.fullName.charAt(0)}
                          </div>
                          <span 
                            onClick={() => navigate(`/${user?.role}/student/${student.id}`)}
                            className="font-medium text-white text-sm hover:text-blue-400 cursor-pointer transition-colors"
                          >
                            {student.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-blue-400 text-sm">{student.login}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button 
                            onClick={() => handleRemoveStudent(student.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Guruhdan chiqarish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ranking Table (if data available) */}
        {rankData && rankData.students && rankData.students.length > 0 && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-800 bg-[#18181b]">
              <h3 className="text-base font-bold text-white tracking-tight">O'quvchilar Reytingi</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-[#09090b] text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 font-bold">
                  <tr>
                    <th className="px-6 py-4 font-medium w-16 text-center">O'rin</th>
                    <th className="px-6 py-4 font-medium">O'quvchi</th>
                    <th className="px-6 py-4 font-medium text-center">Jami Ball</th>
                    <th className="px-6 py-4 font-medium text-center">Bajarilgan</th>
                    <th className="px-6 py-4 font-medium text-center">Kutilmoqda</th>
                    <th className="px-6 py-4 font-medium text-center">Natijalar (Y / K / Q)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 bg-[#09090b]">
                  {rankData.students.map((student: any, idx: number) => (
                    <tr key={student.student?.id || idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 text-center">
                        {idx === 0 ? <Medal className="w-5 h-5 text-yellow-500 mx-auto" /> :
                         idx === 1 ? <Medal className="w-5 h-5 text-zinc-400 mx-auto" /> :
                         idx === 2 ? <Medal className="w-5 h-5 text-amber-700 mx-auto" /> :
                        <span className="font-bold text-zinc-500">{student.rank || idx + 1}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-blue-500 border border-blue-500/20">
                            {student.student?.fullName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p 
                              onClick={() => navigate(`/${user?.role}/student/${student.student?.id}`)}
                              className="font-medium text-white text-sm hover:text-blue-400 cursor-pointer transition-colors"
                            >
                              {student.student?.fullName}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{student.student?.login}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-amber-500 text-base">{student.totalScore}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-emerald-500 font-bold">{student.completed}</span>
                        <span className="text-zinc-500 text-xs"> / {rankData.normativesCount}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-amber-500 font-medium">{student.pending > 0 ? student.pending : '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5 font-medium">
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.green || 0}</span>
                          <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.blue || 0}</span>
                          <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px]">{student.results?.red || 0}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Student Management Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-zinc-800 flex flex-col max-h-[85vh]">
            <h2 className="text-xl font-bold text-white mb-2">
              Guruh o'quvchilari
            </h2>
            <p className="text-sm text-zinc-400 mb-3">Belgilanganlar guruhga qo'shiladi</p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Ism yoki login bo'yicha qidirish..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto mb-6 bg-[#09090b] rounded-xl border border-zinc-800 p-2 divide-y divide-zinc-800">
              {(() => {
                const searchLower = studentSearch.trim().toLowerCase();
                
                const filteredUngrouped = ungroupedStudents.filter(student => {
                  if (!searchLower) return true;
                  return student.fullName.toLowerCase().includes(searchLower) || student.login.toLowerCase().includes(searchLower);
                });

                const filteredAll = allStudents.filter(student => {
                  // Don't show students in all list if they are in ungrouped list
                  if (ungroupedStudents.some(u => u.id === student.id)) return false;
                  
                  if (!searchLower) return true;
                  return student.fullName.toLowerCase().includes(searchLower) || student.login.toLowerCase().includes(searchLower);
                });

                if (filteredUngrouped.length === 0 && filteredAll.length === 0) {
                  return <div className="p-4 text-center text-sm text-zinc-500">O'quvchilar topilmadi. Avval o'quvchi qo'shing.</div>;
                }

                return (
                  <>
                    {filteredUngrouped.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/5 sticky top-0 z-10 backdrop-blur-sm">
                          🔓 Guruhsiz o'quvchilar ({filteredUngrouped.length})
                        </div>
                        {filteredUngrouped.map(student => (
                          <label key={student.id} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 cursor-pointer transition-colors rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-600/10 flex items-center justify-center text-xs font-bold text-emerald-500 border border-emerald-500/20">
                                {student.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-white text-sm">{student.fullName}</p>
                                <p className="text-[10px] uppercase tracking-wider text-emerald-500/70">{student.login}</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-blue-600 bg-[#09090b]"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, student.id]);
                                else setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== student.id));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {filteredAll.length > 0 && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-zinc-400 bg-zinc-900 sticky top-0 z-10 backdrop-blur-sm">
                          Guruhdagi o'quvchilar ({filteredAll.length})
                        </div>
                        {filteredAll.slice(0, 50).map(student => (
                          <label key={student.id} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 cursor-pointer transition-colors rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-xs font-bold text-blue-500 border border-blue-500/20">
                                {student.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-white text-sm">{student.fullName}</p>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{student.login}</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-blue-600 bg-[#09090b]"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, student.id]);
                                else setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== student.id));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowStudentModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSaveStudents}
                disabled={savingStudents}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {savingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : `Saqlash (${selectedStudentIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normative Management Modal */}
      {showNormativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#18181b] rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-zinc-800 flex flex-col max-h-[85vh]">
            <h2 className="text-xl font-bold text-white mb-2">
              Guruh normativlari
            </h2>
            <p className="text-sm text-zinc-400 mb-4">Guruhga yangi normativlar biriktiring</p>
            
            <div className="flex gap-2 mb-4">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#09090b] border border-zinc-800 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Barcha kategoriyalar</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button 
                onClick={handleSelectCategoryAll}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                Barchasini tanlash
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 bg-[#09090b] rounded-xl border border-zinc-800 p-2 divide-y divide-zinc-800">
              {allNormatives.filter(norm => {
                const isAssigned = (group?.normatives || []).some((n: any) => (n.normativeId || n.id) === norm.id);
                const matchCategory = selectedCategoryId === 'all' || norm.categoryId === selectedCategoryId;
                return !isAssigned && matchCategory;
              }).length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">Barcha normativlar allaqachon biriktirilgan.</div>
              ) : (
                allNormatives
                  .filter(norm => {
                    const isAssigned = (group?.normatives || []).some((n: any) => (n.normativeId || n.id) === norm.id);
                    const matchCategory = selectedCategoryId === 'all' || norm.categoryId === selectedCategoryId;
                    return !isAssigned && matchCategory;
                  })
                  .map(norm => (
                    <label key={norm.id} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 cursor-pointer transition-colors rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-blue-500">#{norm.taskNumber}</span>
                        <p className="font-medium text-white text-sm truncate max-w-[280px]">{norm.title}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-blue-600 bg-[#09090b]"
                        checked={selectedNormativeIds.includes(norm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNormativeIds([...selectedNormativeIds, norm.id]);
                          } else {
                            setSelectedNormativeIds(selectedNormativeIds.filter(nid => nid !== norm.id));
                          }
                        }}
                      />
                    </label>
                  ))
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowNormativeModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors border border-zinc-800"
              >
                Yopish
              </button>
              <button
                onClick={handleSaveNormatives}
                disabled={savingNormatives}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {savingNormatives ? <Loader2 className="w-4 h-4 animate-spin" /> : `Saqlash`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
