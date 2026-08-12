#include "PROTHEUS.CH"
#include "RWMAKE.CH"
#include "FWMVCDEF.CH"

User Function CNSAZA2VIEW()
Return

Static Function ModelDef()
    Local l_oStrZA2 := FWFormStruct(1, "ZA2")
    Local l_oModel  := MPFormModel():New(;
        "FCNSAZA2",;
        NIL,;
        NIL,;
        NIL,;
        NIL)

    l_oModel:AddFields(;
        "ZA2MASTER",;
        NIL,;
        l_oStrZA2,;
        NIL,;
        NIL)

    l_oModel:SetPrimaryKey({"ZA2_FILIAL", "ZA2_IDCH", "ZA2_IDGRID"})

Return l_oModel

Static Function ViewDef()
    Local l_oView    := Nil
    Local l_oModel   := FWLoadModel("CNSAZA2VIEW")
    Local l_oStruZA2 := FWFormStruct(2, "ZA2")

    If l_oModel == Nil
        Return Nil
    EndIf

    l_oView := FWFormView():New()
    l_oView:SetModel(l_oModel)
    l_oView:AddField("VIEW_ZA2", l_oStruZA2, "ZA2MASTER")
    l_oView:CreateHorizontalBox("TELA", 100)
    l_oView:SetOwnerView("VIEW_ZA2", "TELA")
    l_oView:EnableTitleView("VIEW_ZA2", "Nova Interacao")
    l_oView:SetCloseOnOk({||.T.})

Return l_oView
