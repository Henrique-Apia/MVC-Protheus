#Include "TOTVS.CH"

/////////////////////////////////////////////////////////////////////////////
// CNSA_JOBFECHA30D - job agendado (roda sozinho, sem usuario logado).
//
// Regra (confirmada por Henrique): chamado com status "1" (Aberto) que nao
// teve ZA1_MOD alterado nos ultimos 30 dias e fechado automaticamente
// (ZA1_STATUS := "4"). So considera status "1" - "Aberto" literal, nao
// "Pendente Apia"/"Pendente Cliente" (status "2"/"3"), que sao estados
// diferentes e nao entram nessa regra.
//
// ATENCAO (Henrique, confere isso): cEmpAnt/cFilAnt abaixo estao com "01"/"01"
// - PLACEHOLDER, nao confirmado. Job roda sem sessao de usuario, RpcSetEnv
// precisa do codigo real de empresa/filial deste ambiente. Ajusta antes de
// registrar o job de verdade.
//
// Registro do job (feito fora do ADVPL, no ambiente): TOTVS SIGACFG ->
// Agendador de Tarefas (Schedule), aponta pra User Function CNSA_JOBFECHA30D,
// frequencia diaria (ex: 1x por dia, de madrugada).
/////////////////////////////////////////////////////////////////////////////
User Function CNSA_FECHA30D()
    Local cEmpAnt      := "01" // PLACEHOLDER - confirmar codigo real da empresa
    Local cFilAnt      := "01" // PLACEHOLDER - confirmar codigo real da filial
    Local dLimite      := Date() - 30
    Local nFechados    := 0
    Local cAlias       := "ZA1FECHA"

    RpcSetType(3)
    If !RpcSetEnv(cEmpAnt, cFilAnt, , , "SIGAAGL", , {"ZA1"})
        ConOut("CNSA_JOBFECHA30D: falha no RpcSetEnv - job abortado.")
        Return
    EndIf

    Begin Sequence

        BeginSql Alias cAlias
            SELECT ZA1.R_E_C_N_O_ RECNO
            FROM %Table:ZA1% ZA1
            WHERE ZA1.ZA1_FILIAL = %xFilial:ZA1%
              AND ZA1.ZA1_STATUS = '1'
              AND ZA1.ZA1_MOD < %Exp:dLimite%
              AND ZA1.%NotDel%
        EndSql

        While !(cAlias)->(Eof())
            ZA1->(DbGoTo((cAlias)->RECNO))

            RecLock("ZA1", .F.)
                ZA1->ZA1_STATUS := "4"
                ZA1->ZA1_MOD    := Date()
            ZA1->(MsUnlock())

            nFechados++
            ConOut("CNSA_JOBFECHA30D: chamado " + AllTrim(ZA1->ZA1_IDCH) + " fechado automaticamente (30 dias sem modificacao).")

            (cAlias)->(DbSkip())
        EndDo

        (cAlias)->(DbCloseArea())

    Recover
        ConOut("CNSA_JOBFECHA30D: erro durante execucao - ver log acima.")
    End Sequence

    ConOut("CNSA_JOBFECHA30D: finalizado - " + AllTrim(Str(nFechados)) + " chamado(s) fechado(s).")

    RpcClearEnv()

Return
