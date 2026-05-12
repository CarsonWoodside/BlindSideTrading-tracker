import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { collectionStore } from './collectionStore'

// Returns { user, session, loading, username, usernameRequired,
//           signUp, signIn, signOut, setUsername, authError }
export function useAuth() {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(null)
    const [username, setUsernameState] = useState(null)
    // true when the user is signed in but has no username yet
    const [usernameRequired, setUsernameRequired] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            if (data.session?.user) fetchProfile(data.session.user.id)
            else setLoading(false)
        })

        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession)
            if (newSession?.user) fetchProfile(newSession.user.id)
            else {
                setUsernameState(null)
                setUsernameRequired(false)
            }
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId) {
        const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .maybeSingle()

        if (data?.username) {
            setUsernameState(data.username)
            setUsernameRequired(false)
        } else {
            setUsernameState(null)
            setUsernameRequired(true)
        }
        setLoading(false)
    }

    async function signUp(email, password, username) {
        setAuthError(null)
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username: username.trim().toLowerCase() },
            },
        })
        if (error) { setAuthError(error.message); return false }
        return true
    }

    async function signIn(email, password) {
        setAuthError(null)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setAuthError(error.message)
            return false
        }
        if (data.user) {
            await collectionStore.migrateLocalToSupabase(data.user.id)
        }
        return true
    }

    async function signOut() {
        await supabase.auth.signOut()
        setSession(null)
        setUsernameState(null)
        setUsernameRequired(false)
    }

    // Called from UsernameModal on submit
    async function setUsername(handle) {
        setAuthError(null)
        const userId = session?.user?.id
        if (!userId) return false

        const clean = handle.trim().toLowerCase()

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId, username: clean }, { onConflict: 'id' })

        if (error) {
            // Unique violation → username taken
            if (error.code === '23505') {
                setAuthError('That username is already taken — try another.')
            } else {
                setAuthError(error.message)
            }
            return false
        }

        setUsernameState(clean)
        setUsernameRequired(false)
        return true
    }

    return {
        user: session?.user ?? null,
        session,
        loading,
        authError,
        username,
        usernameRequired,
        signUp,
        signIn,
        signOut,
        setUsername,
    }
}