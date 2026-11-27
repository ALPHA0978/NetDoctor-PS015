using System;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;

public static class NetDoctorTcpCounters
{
    private const int Data = 1;
    private const uint Established = 5;

    [StructLayout(LayoutKind.Sequential)]
    private struct Row4
    {
        public uint State, LocalAddress, LocalPort, RemoteAddress, RemotePort;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Row6
    {
        public uint State;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] LocalAddress;
        public uint LocalScope, LocalPort;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] RemoteAddress;
        public uint RemoteScope, RemotePort;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Counters
    {
        public ulong DataBytesOut, DataSegsOut, DataBytesIn, DataSegsIn, SegsOut, SegsIn;
        public uint SoftErrors, SoftErrorReason, SndUna, SndNxt, SndMax;
        public ulong ThruBytesAcked;
        public uint RcvNxt;
        public ulong ThruBytesReceived;
    }

    [DllImport("iphlpapi.dll", EntryPoint = "GetPerTcpConnectionEStats")]
    private static extern uint Get4(ref Row4 row, int kind, out byte enabled, uint rwVersion, uint rwSize,
        IntPtr ros, uint rosVersion, uint rosSize, out Counters rod, uint rodVersion, uint rodSize);
    [DllImport("iphlpapi.dll", EntryPoint = "GetPerTcp6ConnectionEStats")]
    private static extern uint Get6(ref Row6 row, int kind, out byte enabled, uint rwVersion, uint rwSize,
        IntPtr ros, uint rosVersion, uint rosSize, out Counters rod, uint rodVersion, uint rodSize);
    [DllImport("iphlpapi.dll", EntryPoint = "SetPerTcpConnectionEStats")]
    private static extern uint Set4(ref Row4 row, int kind, ref byte enabled, uint version, uint size, uint offset);
    [DllImport("iphlpapi.dll", EntryPoint = "SetPerTcp6ConnectionEStats")]
    private static extern uint Set6(ref Row6 row, int kind, ref byte enabled, uint version, uint size, uint offset);

    private static readonly uint CounterSize = (uint)Marshal.SizeOf(typeof(Counters));
    private static uint NetworkPort(int port) { return (ushort)IPAddress.HostToNetworkOrder((short)port); }

    public static ulong[] Read(IPAddress local, int localPort, IPAddress remote, int remotePort)
    {
        byte enabled;
        byte enable = 1;
        uint status;
        Counters counters;
        if (local.AddressFamily == AddressFamily.InterNetwork)
        {
            Row4 row = new Row4 {
                State = Established, LocalAddress = BitConverter.ToUInt32(local.GetAddressBytes(), 0), LocalPort = NetworkPort(localPort),
                RemoteAddress = BitConverter.ToUInt32(remote.GetAddressBytes(), 0), RemotePort = NetworkPort(remotePort)
            };
            status = Get4(ref row, Data, out enabled, 0, 1, IntPtr.Zero, 0, 0, out counters, 0, CounterSize);
            if (status == 0 && enabled == 0 && Set4(ref row, Data, ref enable, 0, 1, 0) == 0)
                status = Get4(ref row, Data, out enabled, 0, 1, IntPtr.Zero, 0, 0, out counters, 0, CounterSize);
        }
        else
        {
            Row6 row = new Row6 {
                State = Established, LocalAddress = local.GetAddressBytes(), LocalScope = (uint)IPAddress.HostToNetworkOrder((int)local.ScopeId), LocalPort = NetworkPort(localPort),
                RemoteAddress = remote.GetAddressBytes(), RemoteScope = (uint)IPAddress.HostToNetworkOrder((int)remote.ScopeId), RemotePort = NetworkPort(remotePort)
            };
            status = Get6(ref row, Data, out enabled, 0, 1, IntPtr.Zero, 0, 0, out counters, 0, CounterSize);
            if (status == 0 && enabled == 0 && Set6(ref row, Data, ref enable, 0, 1, 0) == 0)
                status = Get6(ref row, Data, out enabled, 0, 1, IntPtr.Zero, 0, 0, out counters, 0, CounterSize);
        }
        if (status != 0 || enabled != 1) return null;
        return new[] { counters.DataBytesIn, counters.DataBytesOut, counters.SegsIn, counters.SegsOut };
    }
}
